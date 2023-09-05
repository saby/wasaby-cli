const fs = require('fs-extra');
const pathUtils = require('../Utils/path');
const Template = require('./Template');

const INDEX_FILE_NAME = 'Index.js';
const jsFile = /^[^.]*\.js$/;

const DEFAULT_URL = '/DemoStand/app/:app';
const MAX_NESTING_LEVEL = 2;

const ENOENT = 'ENOENT';

function walkDir(rootDir, callback, exclude = [], currentDir = '') {
   const defCurrentDir = currentDir || rootDir;
   const relativePath = pathUtils.relative(rootDir, defCurrentDir);

   if (fs.pathExistsSync(defCurrentDir)) {
      fs.readdirSync(defCurrentDir).forEach((file) => {
         // пропускаем скрытые файлы
         if (file[0] === '.') {
            return;
         }

         const fullPath = pathUtils.join(defCurrentDir, file);

         try {
            const lstat = fs.lstatSync(fullPath);
            if (!exclude.includes(fullPath)) {
               if (lstat.isDirectory()) {
                  walkDir(rootDir, callback, exclude, fullPath);
               } else {
                  callback(pathUtils.join(relativePath, file));
               }
            }
         } catch (error) {
            // игнорируем ошибки существования файла
            if (!String(error).includes(ENOENT)) {
               throw error;
            }
         }
      });
   }
}

/**
 * Класс отвечающий за генерацию разводящей страницы
 * @author Ганшин Я.О
 */
class DemoIndex {
   constructor(cfg) {
      this.options = cfg.options;
      this.demoModules = this._getDemoModulesList(this.options.get('modules'));
   }

   create() {
      try {
         console.log('Генерация разводящей страницы для демо-примеров');
         let htmlContents = '';

         for (const modulesName of this.demoModules.keys()) {
            htmlContents += DemoIndex.buildNTMLContents(this._buildLinksMap(modulesName), modulesName);
         }

         this._buildIndex(htmlContents);

         console.log('Разводящая успешно сгенерирована');
      } catch (e) {
         e.message = `Генерация разводящей страницы завершена с ошибкой: ${e.message}`;
         throw e;
      }
   }

   _getDemoModulesList(filter = []) {
      const result = new Map();
      const contentsPath = pathUtils.join(this.options.get('resources'), 'contents.json');
      const modules = fs.existsSync(contentsPath) ? fs.readJSONSync(contentsPath).modules : {};

      for (const moduleName of Object.keys(modules)) {
         if (moduleName.endsWith('-demo')) {
            if (filter && filter.length !== 0) {
               if (filter.includes(moduleName)) {
                  result.set(moduleName, pathUtils.join(this.options.get('resources'), moduleName));
               }

               continue;
            }

            result.set(moduleName, pathUtils.join(this.options.get('resources'), moduleName));
         }
      }

      return result;
   }

   _buildLinksMap(moduleName) {
      const links = {};

      walkDir(this.demoModules.get(moduleName), (filePath) => {
         if (DemoIndex.shouldIncludeToMenu(filePath)) {
            const preparedPath = filePath.replace('.js', '');
            DemoIndex.setContents(preparedPath.split('/'), links);
         }
      });

      return links;
   }

   _buildIndex(htmlContents) {
      const title = this.demoModules.size === 1 ? this.demoModules.keys().next().value : 'Demo';

      fs.outputFileSync(pathUtils.join(this.options.get('resources'), 'index.html'), Template.page(title, htmlContents));
   }

   static buildNTMLContents(linksMap, moduleName) {
      const htmlContents = ['', '', '', ''];
      let count = 0;

      for (let name of Object.keys(linksMap)) {
         const list = DemoIndex.buildHtmlList(name, DemoIndex.getContentsList(linksMap[name], [name]), moduleName);

         htmlContents[count % htmlContents.length] += `<div class="contents-block"><h2>${name}</h2>${list}</div>`;
         count++;
      }

      return Template.demoModuleBlock(moduleName, htmlContents);
   }

   static buildHtmlList(name, list, moduleName) {
      let htmlList = '';

      for (let item of list) {
         if (Array.isArray(item)) {
            htmlList += '<li>' +
               `<div class="contents-group-header">${item[0].group}</div>` +
               DemoIndex.buildHtmlList(name, item, moduleName) +
               '</li>';
         } else {
            htmlList += `<li>${DemoIndex.buildLink(item, moduleName)}</li>`;
         }
      }

      return `<ul class="contents-block-ul">${htmlList}</ul>`;
   }

   static buildLink(item, moduleName) {
      const app = [moduleName, item.url].join('/');

      return `<a href="${DEFAULT_URL.replace(':app', encodeURIComponent(app))}">${item.name}</a>`;
   }

   // eslint-disable-next-line no-shadow
   static getContentsList(contents, path = [], diff = 1) {
      let list = [];

      for (let name of Object.keys(contents)) {
         const contentsLength = Object.keys(contents[name]).length;
         const url = path.concat(name);

         if (contentsLength > 1 && path.length <= MAX_NESTING_LEVEL) {
            const newPath = path.concat(name);
            const childList = DemoIndex.getContentsList(contents[name], newPath, newPath.length);

            childList.group = url[diff - 1];
            list.push(childList);
         } else if (contentsLength === 1 || (path.length > MAX_NESTING_LEVEL && contentsLength > 0)) {
            list = list.concat(DemoIndex.getContentsList(contents[name], path.concat(name), diff));
         } else {
            list.push({
               url: url.join('/'),
               name: url.slice(diff).join('/'),
               group: url[diff - 1]
            });
         }
      }

      return list;
   }

   static shouldIncludeToMenu(filePath) {
      const splitPath = filePath.split('/');
      const fileName = splitPath[splitPath.length - 1];
      const splitFileName = fileName.split('.');
      const clearFileName = splitFileName[0];

      return splitPath.some(name => name[0] !== '_') && (
         fileName === INDEX_FILE_NAME ||
         (jsFile.test(fileName) && clearFileName === splitPath[splitPath.length - 2])
      );
   }

   static setContents(contentsPath, contents) {
      let name = contentsPath[0];
      contents[name] = contents[name] || {};

      if (contentsPath.length > 1) {
         DemoIndex.setContents(contentsPath.slice(1), contents[name]);
      }
   }
}

module.exports = DemoIndex;
