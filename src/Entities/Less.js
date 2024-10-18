const fs = require('fs-extra');
const jss = require('jss').default;

const pathUtils = require('../Utils/path');

const createGenerateId = () => {
    return (rule) => {
        return `${rule.key}`
    };
};
jss.setup({createGenerateId});

class Less {
    constructor(path, content) {
        this.content = content || '';
        this.originalContent = this.content;
        this.path = path;
    }

    hasImport(path) {
        return this.content.includes(`@import '${pathUtils.relative(pathUtils.dirname(this.path), path)}';`);
    }

    addImport(path) {
        this.content = this.content.replace(
            /(\s@import\s)/,
            `@import '${pathUtils.relative(pathUtils.dirname(this.path), path)}';$1`
        );
    }

    async fromJSON(path) {
        const rules = await fs.readJSON(path);
        const sheet = jss.createStyleSheet(rules);

        this.content = sheet.toString().replace(/\\([.:])/g, '$1');
    }

    reset() {
        this.content = this.originalContent;

        if (!this.content) {
            return this.delete();
        }

        return this.save();
    }

    read() {
        this.content = fs.readFileSync(this.path, 'utf-8');
        this.originalContent = this.content;
    }

    save() {
        return fs.outputFile(this.path, this.content);
    }

    delete() {
        return fs.remove(this.path);
    }
}

module.exports = Less;