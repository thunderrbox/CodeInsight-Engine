import Dockerode from "dockerode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { config } from "../config";
import { ExecutionResult, Language, SubmissionJob } from "../types";
import { getLanguageConfig } from "./languages";

export class DockerExecutor {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode({ socketPath: config.docker.socketPath });
  }

  async execute(job: SubmissionJob): Promise<ExecutionResult> {
    const langConfig = getLanguageConfig(job.language);
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeinsight-"));

    try {
      // Write the user's code to a temp file
      const codeFilePath = path.join(workDir, langConfig.fileName);
      fs.writeFileSync(codeFilePath, job.code, "utf8");

      // Write stdin to a file if provided
      const stdinFilePath = path.join(workDir, "stdin.txt");
      fs.writeFileSync(stdinFilePath, job.stdin ?? "", "utf8");

      const memoryLimitBytes =
        config.docker.memoryLimitMB * 1024 * 1024;
      const startTime = Date.now();

      if (job.language === Language.JAVA) {
        return await this.runJava(
          job,
          langConfig,
          workDir,
          codeFilePath,
          stdinFilePath,
          memoryLimitBytes,
          startTime
        );
      }

      if (job.language === Language.CPP) {
        return await this.runCpp(
          job,
          langConfig,
          workDir,
          codeFilePath,
          stdinFilePath,
          memoryLimitBytes,
          startTime
        );
      }

      return await this.runContainer(
        langConfig.image,
        langConfig.runCommand(`/workspace/${langConfig.fileName}`),
        workDir,
        stdinFilePath,
        memoryLimitBytes,
        startTime
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  private async runJava(
    _job: SubmissionJob,
    langConfig: ReturnType<typeof getLanguageConfig>,
    workDir: string,
    codeFilePath: string,
    stdinFilePath: string,
    memoryLimitBytes: number,
    startTime: number
  ): Promise<ExecutionResult> {
    // Compile step
    const compileCmd = langConfig.compileCommand!(
      `/workspace/${langConfig.fileName}`,
      "/workspace/Solution"
    );
    const compileResult = await this.runContainer(
      langConfig.image,
      compileCmd,
      workDir,
      stdinFilePath,
      memoryLimitBytes,
      startTime
    );

    if (compileResult.exitCode !== 0) {
      return { ...compileResult, executionTimeMs: Date.now() - startTime };
    }

    // Run step – strip the .java extension to get class name
    const className = path.basename(
      codeFilePath,
      `.${langConfig.fileExtension}`
    );
    const runCmd = ["sh", "-c", `cd /workspace && java ${className}`];
    return this.runContainer(
      langConfig.image,
      runCmd,
      workDir,
      stdinFilePath,
      memoryLimitBytes,
      Date.now()
    );
  }

  private async runCpp(
    _job: SubmissionJob,
    langConfig: ReturnType<typeof getLanguageConfig>,
    workDir: string,
    _codeFilePath: string,
    stdinFilePath: string,
    memoryLimitBytes: number,
    startTime: number
  ): Promise<ExecutionResult> {
    // Compile
    const compileCmd = langConfig.compileCommand!(
      `/workspace/${langConfig.fileName}`,
      "/workspace/solution_bin"
    );
    const compileResult = await this.runContainer(
      langConfig.image,
      compileCmd,
      workDir,
      stdinFilePath,
      memoryLimitBytes,
      startTime
    );

    if (compileResult.exitCode !== 0) {
      return { ...compileResult, executionTimeMs: Date.now() - startTime };
    }

    return this.runContainer(
      langConfig.image,
      ["/workspace/solution_bin"],
      workDir,
      stdinFilePath,
      memoryLimitBytes,
      Date.now()
    );
  }

  private async runContainer(
    image: string,
    cmd: string[],
    workDir: string,
    stdinFilePath: string,
    memoryLimitBytes: number,
    startTime: number
  ): Promise<ExecutionResult> {
    const timeoutMs = config.docker.executionTimeoutMs;
    let timedOut = false;
    let container: Dockerode.Container | undefined;

    try {
      container = await this.docker.createContainer({
        Image: image,
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        OpenStdin: true,
        StdinOnce: true,
        NetworkDisabled: true,
        HostConfig: {
          Binds: [`${workDir}:/workspace:ro`],
          Memory: memoryLimitBytes,
          MemorySwap: memoryLimitBytes,
          CpuQuota: config.docker.cpuQuota,
          CpuPeriod: 100000,
          AutoRemove: false,
          ReadonlyRootfs: true,
          Tmpfs: { "/tmp": "rw,noexec,nosuid,size=64m" },
          SecurityOpt: ["no-new-privileges"],
        },
        WorkingDir: "/workspace",
      });

      const stdinStream = fs.createReadStream(stdinFilePath);

      await container.start();

      // Attach stdin
      const attachStream = await container.attach({
        stream: true,
        stdin: true,
        stdout: false,
        stderr: false,
      });
      stdinStream.pipe(attachStream as NodeJS.WritableStream);
      stdinStream.on("end", () => {
        (attachStream as NodeJS.WritableStream).end();
      });

      // Collect output
      const outputStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
      });

      const { stdout, stderr } = await this.collectOutput(
        outputStream as NodeJS.ReadableStream,
        timeoutMs,
        async () => {
          timedOut = true;
          try {
            await container!.kill();
          } catch {
            // Container may have already exited
          }
        }
      );

      const inspectData = await container.inspect();
      const exitCode = inspectData.State.ExitCode ?? 1;
      const executionTimeMs = Date.now() - startTime;

      return { stdout, stderr, exitCode, executionTimeMs, timedOut };
    } finally {
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          // Container may have been auto-removed
        }
      }
    }
  }

  private collectOutput(
    stream: NodeJS.ReadableStream,
    timeoutMs: number,
    onTimeout: () => Promise<void>
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const MAX_OUTPUT = 1024 * 1024; // 1 MB per stream

      const timer = setTimeout(async () => {
        await onTimeout();
      }, timeoutMs);

      // Docker multiplexes stdout and stderr with an 8-byte header:
      // byte 0: stream type (1=stdout, 2=stderr), bytes 4-7: payload length
      stream.on("data", (chunk: Buffer) => {
        let offset = 0;
        while (offset < chunk.length) {
          if (chunk.length - offset < 8) break;
          const streamType = chunk[offset];
          const payloadLength = chunk.readUInt32BE(offset + 4);
          offset += 8;
          const payload = chunk
            .slice(offset, offset + payloadLength)
            .toString("utf8");
          offset += payloadLength;

          if (streamType === 1) {
            stdout = (stdout + payload).slice(-MAX_OUTPUT);
          } else if (streamType === 2) {
            stderr = (stderr + payload).slice(-MAX_OUTPUT);
          }
        }
      });

      stream.on("end", () => {
        clearTimeout(timer);
        resolve({ stdout, stderr });
      });

      stream.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
