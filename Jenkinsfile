@Library('pipeline') _

def version = '26.4100'

if (prepare_run(version)) {
    node ('ci_cd') {
        checkout_pipeline("rc-${version}")
        run_branch = load '/home/sbis/jenkins_pipeline/platforma/branch/run_branch'
        run_branch.execute('wasaby_cli', version)
    }
}