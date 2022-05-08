import winston from "winston";

/** A nicely-configured logger for Node.js apps.
 * See the [Winston docs](https://github.com/winstonjs/winston) for usage. */
export let log = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => {
          let timestamp = new Date().toLocaleTimeString();
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
  ],
});
