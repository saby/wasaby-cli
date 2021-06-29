const fs = require('fs-extra');
const path = require('path');
const logger = require('../../app/util/logger');
const walkDir = require('../../app/util/walkDir');
const Template = require('./Template');

const INDEX_FILE_NAME = 'Index.js';
const jsFile = /^[^.]*\.js$/;

const DEFAULT_URL = '/DemoStand/app/:app';
const MAX_NESTING_LEVEL = 2;

/**
 * Класс отвечающий за генерацию разводящей страницы
 * @author Ганшин Я.О
 */

class DemoIndex {
   constructor(cfg) {
      this.options = cfg.options;
      this.demoModules = this._getDemoModulesList(this.options.moduleName);
   }

   async create() {
      try {
         logger.log('Генерация разводящей страницы для демо-примеров');
         let htmlContents = '';

         for (const modulesName of this.demoModules.keys()) {
            htmlContents += DemoIndex.buildNTMLContents(this._buildLinksMap(modulesName), modulesName);
         }

         this._buildIndex(htmlContents);

         logger.log('Разводящая успешно сгенерирована');
      } catch (e) {
         e.message = `Генерация разводящей страницы завершена с ошибкой: ${e.message}`;
         throw e;
      }
   }

   _getDemoModulesList(filter = []) {
      const result = new Map();
      const modules = fs.readdirSync(this.options.get('resources'));

      if (filter && filter.length !== 0) {
         for (const moduleName of filter) {
            const modulesPath = path.join(this.options.get('resources'), moduleName);

            if (modules.includes(moduleName)) {
               result.set(moduleName, modulesPath);
            } else {
               throw new Error(`Не найдет модуль ${moduleName} по пути ${modulesPath}`);
            }
         }

         return result;
      }

      for (const moduleName of modules) {
         if (moduleName.endsWith('-demo')) {
            result.set(moduleName, path.join(this.options.get('resources'), moduleName));
         }
      }

      return result;
   }

   _buildLinksMap(moduleName) {
      const links = {};

      walkDir(this.demoModules.get(moduleName), (filePath) => {
         if (DemoIndex.shouldIncludeToMenu(filePath)) {
            const preparedPath = filePath.replace('.js', '');
            DemoIndex.setContents(preparedPath.split(path.sep), links);
         }
      });

      return links;
   }

   _buildIndex(htmlContents) {
      const title = this.demoModules.size === 1 ? this.demoModules.keys().next().value : 'Demo';

      fs.outputFileSync(path.join(this.options.get('resources'), 'index.html'), Template.page(title, htmlContents));
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
      const splitPath = filePath.split(path.sep);
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
