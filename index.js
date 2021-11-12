import axios from "axios";
import cheerio from "cheerio";
import express, { response } from "express";

const app = express()
app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('index')
})

app.get('/cnpjxcep', async(req, res) => {
  const inicial = req.query.inicial
  const final = req.query.final

  let oldCEP = ''
  let filteredData = []
  let data = []
  let CEP = inicial

  const f1 = async CEP => {
    await axios(`https://www.google.com.br/search?q=${CEP}+site%3Acnpj.biz`).then(response => {
      const html = response.data
      const $ = cheerio.load(html)
      $('h3', html).each(function() {
        const title = $(this).text()
        const link = $(this).parent().attr('href').substring(7, 38)
        const cnpj = link.substring(17) || ''
        if(link.substring(8, 12) === 'cnpj') {
          data.push({title, link, cnpj})
        }
      })
    })
  }

  const f2 = async (i, jump = 0) => {
    await axios(`https://cnpj.biz/${data[i + jump].cnpj}`).then( async response => {
      const html = response.data
      const $ = cheerio.load(html)
      const arr = []
      $('.row p', html).each(async function() {
        arr.push($(this).text())
      })
      data[i + jump].situacao = arr.filter(value => value.substring(0, 9) === 'Situação:')[0].substring(10)
      data[i + jump].razao = arr.filter(value => value.substring(0, 13) === 'Razão Social:')[0].substring(14)
    })
    if ((i + jump) !== data.length - 1) {
      i++;
      await f2(i, jump)
    }
  }

  const newLoop = async final => {
    final = Number(final.substring(6))
    oldCEP = CEP
    CEP = `${CEP.substring(0,5)}-${Number(CEP.substring(6)) < final? Number(CEP.substring(6)) + 1: Number(CEP.substring(6))}`
    if (oldCEP === CEP) {
      return
    }
    let jump = data.length - 1
    await f1(CEP)
    await f2(0, jump)
    if(data.filter(value => value.situacao === 'Ativa').length < 8) {
      setTimeout(async() => await newLoop(req.query.final), 2000)
    } else {
      console.log(data.filter(value => value.situacao === 'Ativa'))
      res.render('cnpjxcep', {inicial, final, filteredData: data.filter(value => value.situacao === 'Ativa')})
    }
  }

  await f1(CEP)
  await f2(0)
  filteredData = data.filter(value => value.situacao === 'Ativa')

  if (filteredData.length < 8) {
    filteredData = await newLoop(req.query.final)
  } else {
    console.log(filteredData)
  }

})


const port = process.env.PORT || 3000;
app.listen(port, () => console.log('servidor no ar'))