declare module 'castv2-client' {
  export class Client {
    connect(host: string | { host: string; port: number }, cb: () => void): void
    launch(app: unknown, cb: (err: Error | null, app: unknown) => void): void
    close(): void
    on(event: string, cb: (err: Error) => void): void
  }

  export class Application {
    constructor(client: unknown, session: unknown)
    createController(Ctor: unknown): unknown
  }

  export class RequestResponseController {
    constructor(client: unknown, sourceId: string, destinationId: string, namespace: string)
    request(data: object, cb?: (err: Error | null, data?: Record<string, unknown>) => void): void
  }

  export class DefaultMediaReceiver extends Application {
    static APP_ID: string
  }
}
