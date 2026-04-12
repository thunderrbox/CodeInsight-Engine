FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /sandbox

RUN adduser -D runner
USER runner

CMD ["node"]