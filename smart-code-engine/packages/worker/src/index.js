import Dockerode from "dockerode";
import { v4 as uuidv4 } from "uuid";

const docker = new Dockerode();

export async function runCode(language, code) {
  const containerId = uuidv4();
  // Spin up sandbox container, run code, return output
  // Wire to docker/sandbox image
  console.log(`Running ${language} job: ${containerId}`);
}
