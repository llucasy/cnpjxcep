import axios from "axios";
import cheerio from "cheerio";
import express from "express";
import {Server} from 'socket.io'
import { createServer } from 'http';
import globaldb from "./db.js";

const app = express()

var server = createServer(app);
var io = new Server(server)


app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static('public'))

app.get('/', (req, res) => {

  globaldb.count({}, (e, count) => {
    if (e) { return console.log(e);}

    res.render('index', {count})
  })

})


app.get('/cnpjxcep', async(req, res) => {
  const cep = String(req.query.cep)

  if (cep.length !== 9) {
    return res.send('CEP inválido, quatidade de dígitos não bate!')
  } else if (isNaN(cep.substring(0, 5)) || isNaN(cep.substring(6))) {
    return res.send('Além do traço, o CEP deve conter somente números')
  }

  const response = await axios.get(`https://www.cepaberto.com/api/v3/cep?cep=${cep.substring(0, 5)}${cep.substring(6)}`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Authorization': `Token token=${process.env.CEPABERTO_TOKEN}`
    }
  })

  const cidade = response.data.cidade.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(" ", "-").toLowerCase() + '-' + response.data.estado.sigla.toLowerCase()

  
  io.on('connection', async (socket) => {
    socket.emit('info', 'buscando...')

    socket.on('executar', async() => {
      globaldb.findAll({ localization: cidade }, async(e, docs) => {
        if (e) { return console.log(e);}

        let countCNPJs = 0
    
        if (docs.length > 0) {
          countCNPJs += docs.length
          docs.forEach((doc) => {
            socket.emit('busca', doc)
          })
        }

        if (countCNPJs < 15) {

          const links = await (await axios.get(`https://getcnpj.vercel.app/api/hello?cidade=${cidade}`)).data
          
          const cnpjs = links.cnpjs.filter(value => value.substring(17) !== (docs.find( obj => obj.cnpj === value.substring(17)) || {}).cnpj)

          
          const validatecnpj = async (cnpjs, i) => {

            socket.emit('info', `Buscando ${i + 1} de ${cnpjs.length} da primeira página...`)
            
            const data = {}
            const cnpj = cnpjs[i].substring(17)
            
            const dataOfCNPJ = await (await axios.get(`https://getcnpj.vercel.app/api/validatecnpj?cnpj=${cnpj}`)).data
            
            data.razao = dataOfCNPJ.filter(value => value.substring(0, 13) === 'Razão Social:')[0].substring(14)
            data.cnpj = cnpj
            data.situacao = dataOfCNPJ.filter(value => value.substring(0, 9) === 'Situação:')[0].substring(10)
            data.cep = (dataOfCNPJ.filter(value => value.substring(0, 4) === 'CEP:')[0] || '').substring(5)
            data.localization = cidade
            data.lastCheck = new Date()
            
            if(data.situacao === 'Ativa') {
              socket.emit('busca', data)
              countCNPJs ++
              globaldb.insertMany([data], (err, result) => {
                if (e) { return console.log(e)}
              }) 
            }
            
            if(i < (cnpjs.length - 1) && countCNPJs < 15) {
              i ++
              validatecnpj(cnpjs, i)
            } else {
              socket.emit('info', 'Concluído')
            }
          }

          await validatecnpj(cnpjs, 0)
        } else {
          socket.emit('info', 'Concluído')
        }
      })
  
      socket.on('disconnect', async() => {
        console.log('user disconnected');
        io.removeAllListeners()
      });
      
    })
  })

  res.render('cnpjxcep', { cep, cidade: response.data.cidade.nome})

})

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('servidor no ar'))