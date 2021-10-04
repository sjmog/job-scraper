const fs = require('fs')
const readline = require('readline')
const indeed = require('indeed-scraper')

const pathToJobsFile = './jobs.json'
const pathToQueryOptionsFile = './queryOptions.json'

const analyse = (jobs, queryOptions, callback) => {
  console.log('Using queryOptions ' + JSON.stringify(queryOptions))

  console.log(`Number of jobs in ${queryOptions.maxAge} days: ` + jobs.length)

  if(callback) callback()
}

const run = async () => {
  console.log(`Welcome to the job scraper. Give me some parameters, and I'll scrape Indeed for jobs.`)
  console.log('Setting up...')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  let jobsFileExists = undefined
  let queryOptionsFileExists = undefined

  const checkForFiles = () => new Promise(resolve => {
    fs.access(pathToJobsFile, fs.F_OK, (err) => {
      jobsFileExists = !err

      fs.access(pathToQueryOptionsFile, fs.F_OK, (err) => {
        queryOptionsFileExists = !err

        resolve()
      })
    })
  })

  console.log('checking for existing data...')

  await checkForFiles()

  console.log(jobsFileExists ? 'previous scraping data exists' : 'looks like this is your first scrape!')

  let useFile = undefined

  const askIfUseFile = () => new Promise(( resolve, reject ) => {
    rl.question('Use local file? (y/n)', (answer) => {
      const lowerCaseAnswer = answer.toLowerCase()

      if(lowerCaseAnswer !== 'y' && lowerCaseAnswer !== 'n') {
        console.log('Please answer y or n.')
        return askIfUseFile()
      }

      if(lowerCaseAnswer === 'y') useFile = true
      if(lowerCaseAnswer === 'n') useFile = false

      resolve()
    })
  })

  if(jobsFileExists && queryOptionsFileExists) await askIfUseFile()

  if(useFile) {
    const jobsJSON = await fs.readFileSync(pathToJobsFile)
    const queryOptionsJSON = await fs.readFileSync(pathToQueryOptionsFile)

    const jobs = await JSON.parse(jobsJSON)
    const queryOptions = await JSON.parse(queryOptionsJSON)

    analyse(jobs, queryOptions, () => process.exit())
  }

  const queryOptions = {
    host: "uk.indeed.com",
    sort: 'date',
    limit: 0
  }

  const askForQueryOption = ({ option, queryText = null, permittedValues = [], transform = answer => answer }) => new Promise(resolve => {
    const text = queryText || option
    const permittedValuesString = permittedValues.join(', ')

    const question = `Enter ${text}${permittedValues.length > 0 ? ` [Must be one of: ${ permittedValuesString }]` : ''}: `

    rl.question(question, (answer) => {
      if(permittedValues.length > 0 && !permittedValues.includes(answer)) {
        console.log(`${option} should be one of: ${permittedValuesString}`)
        return askForQuestionOption(option, textOverride, permittedValues)
      }
      queryOptions[option] = transform(answer)

      resolve()
    })
  })

  await askForQueryOption({ option: 'query', queryText: 'job title' })
  await askForQueryOption({ option: 'level', permittedValues: ['entry_level', 'mid_level', 'senior_level'] })
  await askForQueryOption({ option: 'city' })
  await askForQueryOption({ option: 'radius', queryText: 'radius (in miles)' })
  await askForQueryOption({ option: 'maxAge', queryText: 'max age (in days)' })

  console.log('queryOptions set.')

  const saveToFile = (name, js, path) => new Promise(resolve => {
    const data = JSON.stringify(js)
    fs.writeFile(path, data, (err) => {
      if(err) throw err

      console.log(`${name} saved to ${path}`)
      resolve()
    })
  })

  await saveToFile('queryOptions', queryOptions, pathToQueryOptionsFile)

  console.log('Querying jobs from Indeed...')

  const awaitingDots = setInterval(() => console.log('...'), 2000)
  const jobs = await indeed.query(queryOptions)
  clearInterval(awaitingDots)

  console.log('Jobs fetched from Indeed')
  await saveToFile('jobs', jobs, pathToJobsFile)

  analyse(jobs, queryOptions, () => process.exit())
}

run()
