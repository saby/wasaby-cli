'use strict';

/**
 * @class FormattedTestResults
 * @property numFailedTests {number}
 * @property numFailedTestSuites {number}
 * @property numPassedTests {number}
 * @property numPassedTestSuites {number}
 * @property numPendingTests {number}
 * @property numPendingTestSuites {number}
 * @property numRuntimeErrorTestSuites {number}
 * @property numTotalTests {number}
 * @property numTotalTestSuites {number}
 * @property numTodoTests {number}
 * @property startTime {number}
 * @property success {boolean}
 * @property testResults {TestResult[]}
 * @property wasInterrupted {boolean}
 */
/**
 * @class TestResult
 * @property console? {ConsoleBuffer}
 * @property sourceMaps? {{ [sourcePath: string]: string }}
 * @property failureMessage? {string | null}
 * @property leaks {boolean}
 * @property numFailingTests {number}
 * @property numPassingTests {number}
 * @property numPendingTests {number}
 * @property numTodoTests {number}
 * @property openHandles {Error[]}
 * @property skipped {boolean}
 * @property testFilePath {string}
 * @property testResults {AssertionResult[]]}
 * @property displayName?
 * @property displayName.name {string}
 * @property displayName.color {string}
 * @property perfStats
 * @property perfStats.end {number}
 * @property perfStats.runtime {number}
 * @property perfStats.slow {boolean}
 * @property perfStats.start {number}
 * @property snapshot
 * @property snapshot.added {number}
 * @property snapshot.fileDeleted {boolean}
 * @property snapshot.matched {number}
 * @property snapshot.unchecked {number}
 * @property snapshot.uncheckedKeys {string[]}
 * @property snapshot.unmatched {number}
 * @property snapshot.updated {number}
 */
/**
 * @class AssertionResult
 * @property ancestorTitles {string[]}
 * @property duration? {number | null}
 * @property failureDetails {unknown[]}
 * @property failureMessages {string[]}
 * @property fullName {string}
 * @property invocations? {number}
 * @property location? {{ column: number, line: number } | null}
 * @property numPassingAsserts {number}
 * @property status {'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'}
 * @property title {string}
 */
/**
 * @class ConsoleBuffer
 * @property message {string}
 * @property origin {string}
 * @property type {'assert' | 'count' | 'debug' | 'dir' | 'dirxml' | 'error' | 'group' | 'groupCollapsed' | 'info' | 'log' | 'time' | 'warn'}
 */

const xml = require('xml');
const mkdirp = require('mkdirp');
const fs = require('fs-extra');
const path = require('path');

function displayNameToString(displayName) {
   if (typeof displayName === 'string') {
      return displayName;
   }

   if (typeof displayName.name === 'string') {
      return displayName.name;
   }

   return displayName;
}

/**
 * Build xml format data.
 * @param results {FormattedTestResults}
 * @param options
 */
function buildXmlData(results, options) {
   const testsuite = {
      'testsuite': [{
         '_attr': {
            'name': options.suiteName,
            'tests': results.numTotalTests,
            'errors': results.numRuntimeErrorTestSuites,
            'failures': results.numFailedTests,
            'skipped': results.numPendingTests,
            'todo': results.numTodoTests,
            // Overall execution time:
            // Since tests are typically executed in parallel this time can be significantly smaller
            // than the sum of the individual test suites
            'time': ((Date.now() - results.startTime) / 1000)
         }
      }]
   };

   for (const testResult of results.testResults) {

      if (testResult.testExecError) {
         testsuite.testsuite.push({
            'testcase': [{
               '_attr': {
                  'classname': `${options.suiteName}.Test suite failed to run`,
                  'name': testResult.testFilePath,
                  'time': 0
               }
            }, {
               'failure': testResult.failureMessage.replace(/\x1b[[\d]+m/g, '')
            }]
         });
         continue;
      }

      const displayName = displayNameToString(testResult.displayName);

      for (const assertionResult of testResult.testResults) {
         const classname = `${displayName}.${assertionResult.ancestorTitles.join(options.ancestorSeparator)}`;
         const testcase = {
            'testcase': [{
               '_attr': {
                  'classname': classname,
                  'name': assertionResult.title,
                  'time': (assertionResult.duration / 1000)
               }
            }]
         };

         if (assertionResult.status === 'failed' || assertionResult.status === 'error') {
            for (const failure of assertionResult.failureMessages) {
               testcase.testcase.push({
                  'failure': failure.replace(/\x1b[[\d]+m/g, '')
               });
            }
         } else if (assertionResult.status === 'pending') {
            testcase.testcase.push({
               'skipped': { }
            });
         }

         testsuite.testsuite.push(testcase);
      }

      if (testResult.console && testResult.console.length > 0) {
         for (const item of testResult.console) {
            testsuite.testsuite.push({
               'system-out': {
                  '_cdata': item.message.replace(/\x1b[[\d]+m/g, '')
               }
            });
         }
      }
   }

   return testsuite;
}

class Reporter {

   /**
    * Initialize new instance of Jest reporter.
    * @param config Jest config.
    * @param options {{ suiteName: string, outputFile: string }} Jest options.
    */
   constructor(config, options) {
      this.config = config;
      this.options = options;
      this.consoleBuffer = { };
   }

   /**
    * Process test suite results.
    * @param test {{ context: any, duration: number, path: string }}
    * @param testResult {TestResult}
    */
   onTestResult(test, testResult) {
      if (testResult.console && testResult.console.length > 0) {
         this.consoleBuffer[testResult.testFilePath] = testResult.console;
      }
   }

   /**
    * Complete all test results.
    * @param contexts {Set}
    * @param results {FormattedTestResults}
    */
   onRunComplete(contexts, results) {
      this.flushConsoleData(results);
      this.saveXmlArtifact(results);
   }

   /**
    * Append console outputs to test results.
    * @param results {FormattedTestResults}
    */
   flushConsoleData(results) {
      results.testResults.forEach((testSuite) => {
         testSuite.console = this.consoleBuffer[testSuite.testFilePath];
      });
   }

   /**
    * Prepare results and save xml artifact.
    * @param results {FormattedTestResults}
    */
   saveXmlArtifact(results) {
      const xmlData = buildXmlData(results, this.options);
      mkdirp.sync(path.dirname(this.options.outputFile));
      fs.writeFileSync(this.options.outputFile, xml(xmlData, { indent: '  ', declaration: true }));
   }
}

module.exports = Reporter;
