const path = require('path');
const fs = require('fs-extra');
const Shell = require('./shell');

const _private = {
   /**
    * Возвращает путь до исполняемого файла джина
    * @returns {string}
    * @public
    */
   getJinneeConvert(pathToJinnee) {
      if (process.platform === 'win32') {
         return `"${path.join(pathToJinnee, 'jinnee-utility.exe')}" libjinnee-db-converter300.dll'`;
      }
      return `${path.join(pathToJinnee, 'jinnee-utility')} libjinnee-db-converter300.so`;
   },

   /**
    * Возвращает путь до исполняемого файла джина
    * @returns {string}
    * @public
    */
   getJinneeDeployCli(pathToJinnee) {
      if (process.platform === 'win32') {
         return `"${path.join(pathToJinnee, 'jinnee-utility.exe')}" jinnee-dbg-stand-deployment300.dll`;
      }
      return `${path.join(pathToJinnee, 'jinnee-utility')} libjinnee-dbg-stand-deployment300.so`;
   }

}

/**
 * Класс для вызова утилит из сдк
 * @class sdk
 * @author Ганшин Я.О.
 */
class sdk {
   constructor(cfg) {
      this._rc = cfg.rc;
      this._workspace = cfg.workspace;
      this._pathToJinnee = cfg.pathToJinnee;
      this._shell = new Shell();
   }

   /**
    * Вызывает конвертацию бд
    * @param {String} dbSchema схема конвертации dbschema
    * @param {String} project конфиг проекта s3cld
    * @returns {Promise<any>}
    */
   async jinneeConvert(dbSchema, project) {
      const pathToJinnee = await this.getPathToJinnee();
      const jinneeCli = _private.getJinneeConvert(pathToJinnee);

      return this._shell.execute(
         `${jinneeCli} --project=${project} --deploy_db=${dbSchema}`,
         pathToJinnee, {
            name: 'jinnee-convert'
         }
      );
   }

   /**
    * Вызывает разворот сервера
    * @param {String} deploy конфиг разворота s3deploy
    * @param {String} logs папка в которую писать логи
    * @param {String} project конфиг проекта s3cld
    * @returns {Promise<any>}
    */
   async jinneeDeploy(deploy, logs, project) {
      const pathToJinnee = await this.getPathToJinnee();
      const jinneeCli = _private.getJinneeDeployCli(pathToJinnee);

      return this._shell.execute(
         `${jinneeCli} --deploy_stand=${deploy} --logs_dir=${logs} --project=${project}`,
         pathToJinnee, {
            name: 'jinnee-deploy'
         }
      );
   }

   /**
    * Возвращает путь до папки с джином, если джин в архиве распаковывает в рабочую директорию
    * @returns {Promise<string|*>}
    * @public
    */
   async getPathToJinnee() {
      const pathToSDK = this.getPathToSdk();
      let pathToJinnee = '';
      if (this._pathToJinnee) {
         pathToJinnee = this._pathToJinnee;
      } else if (process.env.SDK) {
         pathToJinnee = path.join(pathToSDK, 'tools', 'jinnee', 'jinnee.zip');
      } else {
         pathToJinnee = path.join(pathToSDK, 'tools', 'jinnee');
      }

      if (!fs.existsSync(pathToJinnee)) {
         throw new Error(`Не существует путь до джина: ${pathToJinnee}`);
      }

      if (fs.statSync(pathToJinnee).isFile()) {
         const unpack = path.join(this._workspace, 'jinnee');
         await this._shell.execute(
            `7za x ${pathToJinnee} -y -o${unpack} > /dev/null`,
            process.cwd()
         );
         return unpack;
      }

      return pathToJinnee;
   }

   /**
    * Возвращает путь до SDK
    * @returns {string}
    * @public
    */
   getPathToSdk() {
      let pathToSDK;
      const sdkVersion = this._rc.replace('rc-', '').replace('.', '');

      if (process.env.SDK) {
         pathToSDK = process.env.SDK;
         process.env['SBISPlatformSDK_' + sdkVersion] = pathToSDK;
      } else {
         pathToSDK = process.env['SBISPlatformSDK_' + sdkVersion];
      }

      if (!pathToSDK) {
         throw new Error(`SDK версии ${sdkVersion} не установлен`);
      }

      if (!fs.existsSync(pathToSDK)) {
         throw new Error(`Не найден SDK по пути: ${pathToSDK}`);
      }

      return pathToSDK;
   }
}

module.exports = sdk;
