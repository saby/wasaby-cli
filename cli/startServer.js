const DemoIndex = require('../src/DemoIndex/DemoIndex');
const WidgetsShop = require('../src/DemoIndex/WidgetsShop');

module.exports = async(options, project) => {
    const createIndex = new DemoIndex({
        options: options.params
    });
    const widgetsShop = new WidgetsShop({
        options: options.params
    });

    await Promise.all([
        createIndex.create(),
        widgetsShop.create()
    ]);

    await project.startServer();
};
