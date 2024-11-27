#!/usr/bin/env node
/**
 * Утилита для сборки и запуска юнит тестов
 * @author Кудрявцев И.С.
 */

const { Command, Option } = require('commander')
const logger = require('./src/Utils/Logger');
const packageJson = require('./package.json');
const fs = require('fs-extra');
const Config = require('./src/Utils/Config');
const pathUtils = require('./src/Utils/path');

const ERROR_CODE = 2;

// TODO С 15-й версии Node.js --unhandled-rejections по умолчанию throw и наши юнит-тесты не проходят.
//  Надо сделать, чтобы была опция строгого режима, которая будет выставлять throw.
//  https://online.sbis.ru/opendoc.html?guid=83d02cb1-e300-4963-9d63-d5ee9de74d32
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --unhandled-rejections=warn`;

function getArgs() {
   const result = [];

   for (const arg of process.argv) {
      if (arg.includes('=')) {
         const [name, value] = arg.split('=');

         result.push(name);

         if (value.includes(',')) {
            const values = value.split(',');

            for (const val of values) {
               result.push(val);
            }
         } else {
            result.push(value);
         }
      } else {
         result.push(arg);
      }
   }

   return result;
}

const cliCommand = new Command()
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .configureHelp({
       showGlobalOptions: true
    })
    .addOption(new Option('--consoleLevel <level>', 'Уровень логирования в консоли.')
        .choices(['error', 'info', 'debug'])
        .default('info')
    )
    .addOption(new Option('--artifactsDir <path>', 'Путь до папки с артефактами.')
        .default(pathUtils.join(process.cwd(), 'wasaby-cli_artifacts'))
        .argParser(Config.pathParser)
    )
    .addOption(new Option('-c, --config <path>', 'Путь до до json файла конфигурации.')
        .argParser(Config.pathParser)
    )
    .addOption(new Option('--store <path>', 'Путь до папки с репозиториями.')
        .argParser(Config.pathParser)
    )
    .addOption(new Option('--repositories <urls...>', 'Список репозиториев, которые надо доабвить в хранилище.')
        .default([])
        .hideHelp()
    )

for (const commandName of fs.readdirSync(`${__dirname}/cli`)) {
   const command = require(`${__dirname}/cli/${commandName}`);

   cliCommand.addCommand(command);
}


cliCommand.parseAsync(getArgs()).then(() => {
   console.log('Finishing Wasaby-cli');
}, (error) => {
   if (error instanceof Error) {
      console.error(error);
   } else {
      console.error(error.message || error);
   }

   process.exit(error.exitCode || ERROR_CODE);
});

process.on('uncaughtException', (err) => {
   logger.error(err);
});

process.on('exit', () => {
   logger.close();
});
