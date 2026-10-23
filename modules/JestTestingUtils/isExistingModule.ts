//@ts-ignore
const root: string = __dirname;

function buildPath(moduleName: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodePath = require('node:path');

    const name = moduleName
        .replace('optional!', '')
        .replace('browser!', '')
        .replace('is!browser?', '')
        .split(':')[0];

    if (name.startsWith('cdn/') || name.startsWith('/cdn/')) {
        return nodePath.join(root, '..', name);
    }

    if (name.includes('!')) {
        const [plugin, path] = name.split('!');

        if (plugin === 'wml' || plugin === 'tmpl') {
            return nodePath.join(root, '..', `${path}.${plugin}.js`);
        }

        if (plugin === 'i18n') {
            return nodePath.join(root, '..', `I18n/i18n.js`);
        }

        return nodePath.join(root, '..', `${path}.${plugin}`);
    }

    return nodePath.join(root, '..', `${name}.js`);
}

export default function isExistingModule(moduleName: unknown): boolean {
    if (typeof moduleName !== 'string') {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs');

    try {
        return fs.existsSync(buildPath(moduleName));
    } catch (_error) {
        return false;
    }
}
