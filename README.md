# test-cli
Приложение для запуска юнит тестов платформы. 
Результат тестов находится в папке application/artifacts

## Параметры
    branch - Ветка которую надо протестировать
    rc - Рц ветка 
    rep - Название репозитория по которому надо запустить тесты, параметр name в package.json  
    store - Папка в которую будут клонироваться хранилища
    workDir - Папка в которой соберется сбоорка билдером по умолчанию application
    ports - Порты на которых запускать тест сервер  
    tasks - Задачи которые нужно выполнить, по умолчанию запускаются все три:    
        initStore - Клонирование и чекаут на нужные ветки хранилищ
        build - Сборка 
        startTest - Запуск тестов
    withBuilder - Разворот с помощью билдера, по умолчанию используется genie
    builderConfig - Путь к конфигу билдера, по умолчанию используется builderConfig.base.json из test-cli
    server - Запускает  сервер для юнитов, сами юниты не выполняются   
    only - Запускает тесты только для переданного репозитория, без зависимостей
    projectDir - Папка в которой лежит проект jinnee   
    builderCache - Папка с кешем для билдера
          
    Пример:
        node cli --branch=20.1000/bugfix/mergeable-options --rc=rc-20.1000 --rep=Types --withBuilder --only

## Запуск локально
    Установка test-cli 
        npm install git+https://git.sbis.ru/sbis/test-cli.git#rc-20.1000 --save-dev
        
    Соборка проекта
        Когда test-cli утанавливается как npm зависимость, при инициализации хранилища анализируется package.json 
        родительского проекта, репозитории, которые есть в package.json скачиваться не будут.      
        
            node node_modules/test-cli/cli.js --tasks=initStore,build --builderConfig=./buildTemplate.json
        
        По умолчанию, репозиторий для которого разворачивается стенд берется из package.json, если надо запустить разворот 
        для другого репозитория, то передаем парамет --rep с названием (параметр name в package.json нужного репозитория, 
        например для котролов это sbis3-control) 
        
             node node_modules/test-cli/cli.js --tasks=initStore,build  --rep=saby-types,sbis3-controls  --builderConfig=./buildTemplate.json --only
        
    Запуск тестов
        Для запуска всех тестов по текущему репозиторию, результаты, можно найти в папке application/artefacts
                
            node node_modules/test-cli/cli.js --tasks=startTest
    
        Для запуска по конкретному репозиторию 
        
             node node_modules/test-cli/cli.js --tasks=startTest --rep=sbis3.engine --only
         
         
        
    Отладка тестов
        Для отладки тестов в браузере, можно запустить тест сервер: 
        
            node node_modules/test-cli/cli.js --tasks=startTest --server --only 
        
        Если надо отлаживать тесты из другого репозитория передаем параметр rep:
        
            node node_modules/test-cli/cli.js --tasks=startTest  --rep=saby-types --only
        
        Под нодой отлаживать тесты через test-cli можно только через remote debugger, потому что тесты запускаются как под задача,
        но можно запустить на выполнение один раз что бы сгенерировался конфиг и потом запускать напрямую и отлаживать как обычно
            Запуск для создания конфига (конфиги создаются в папке node_modules/test-cli):    
        
                node node_modules/test-cli/cli.js --tasks=startTest  --rep=saby-types  --only
        
            Запуск тестов для дебага:
        
                node node_modules/saby-units/cli.js --isolated --config=node_modules/test-cli/testConfig_saby-types.json
