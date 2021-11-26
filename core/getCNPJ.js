import puppeteer from 'puppeteer-core'
import chrome from 'chrome-aws-lambda'

export async function getOptions() {
  const isDev = !process.env.AWS_REGION
  let options;

  const chromeExecPaths = {
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    linux: '/usr/bin/google-chrome',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }

  const exePath = chromeExecPaths[process.platform]

  if (isDev) {
    options = {
      args: [],
      executablePath: exePath,
      headless: true,
      defaultViewport: null
    }
  } else {
    options = {
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless
    }
  }

  return options
}

let _page
async function getPage() {
  if (_page) {
    return _page
  }

  const options = await getOptions()
  const browser = await puppeteer.launch(options)

  _page = await browser.newPage()

  return _page
}


export async function getScreenshot(html, { width, height } = { width: 800, height: 800 }) {
  const page = await getPage();

  await page.setContent(html);
  await page.setViewport({ width, height });

  const file = await page.screenshot({ type: 'png' });

  return file;
}


export async function getCNPJ(cidade) {
  const page = await getPage();

  await page.goto(`https://cnpj.biz/empresas/${cidade}`, { waitUntil: "networkidle2" });
  const links = await page.evaluate(() => {
    const arr = []
    document.querySelectorAll('.hero a').forEach((e, i, a) => {
      arr.push(a[i].href)
    })
    const cnpjs = arr.filter((e, i) => arr.indexOf(e) === i);
    const nextPage = cnpjs.pop()

    return { cnpjs, nextPage }
  })

  return links

}