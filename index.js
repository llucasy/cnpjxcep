import axios from "axios";
import cheerio from "cheerio";
import express from "express";

const app = express()

import {Server, Socket} from 'socket.io'
import { createServer } from 'http';

var server = createServer(app);
var io = new Server(server)


app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('index')
})

let oldCEP = ''
let filteredData = []
let data = []


app.get('/cnpjxcep', async(req, res) => {
  const inicial = req.query.inicial
  const final = req.query.final
  let CEP = inicial
  
  io.on('connection', async(socket) => {

    socket.emit('info', 'buscando...')
    
    data.length = 0
    filteredData.length = 0
    await f1(CEP)
    await f2(0, 0, socket)
    filteredData = data.filter(value => value.situacao === 'Ativa')
  
    if (filteredData.length < 8) {
      filteredData = await newLoop(final, inicial, socket)
    } else {
      console.log(filteredData)
      socket.emit('busca', filteredData)
    }

    socket.on('disconnect', function(){
      data.length = 0
      filteredData.length = 0
      console.log('user disconnected');
    });

  })

  res.render('cnpjxcep', {inicial, final})

})

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

const f2 = async (i, jump = 0, socket) => {
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
  if(data[i + jump].situacao === 'Ativa') {
    socket.emit('busca', data[i + jump])
  }
  if ((i + jump) !== data.length - 1) {
    i++;
    await f2(i, jump, socket)
  }
}

const newLoop = async (final, inicial, socket) => {
  final = Number(final.substring(6))
  oldCEP = inicial
  inicial = `${inicial.substring(0,5)}-${Number(inicial.substring(6)) < final? Number(inicial.substring(6)) + 1: Number(inicial.substring(6))}`
  if (oldCEP === inicial) {
    return
  }
  let jump = data.length - 1
  await f1(inicial)
  await f2(0, jump, socket)
  if(data.filter(value => value.situacao === 'Ativa').length < 8) {
    setTimeout(async() => await newLoop(final, inicial), 2000)
  } else {
    console.log(data.filter(value => value.situacao === 'Ativa'))
  }
}



const port = process.env.PORT || 3000;
server.listen(port, () => console.log('servidor no ar'))