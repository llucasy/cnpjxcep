import dotenv from "dotenv";
dotenv.config()

import mongodb from "mongodb";

mongodb.MongoClient
  .connect(
    "mongodb+srv://" +
      process.env.DB_LOGIN +
      ":" +
      process.env.DB_PASS +
      "@cluster0-ayz50.mongodb.net/workshop?retryWrites=true&w=majority",
    { useUnifiedTopology: true }
  )
  .then(conn => (global.conn = conn.db("cnpjxcep")))
  .catch(err => console.log(err));

  function findAll(item, callback) {
    global.conn
      .collection("cnpjs")
      .find(item)
      .toArray(callback);
  }

  function updateOne(cnpj, item, callback) {
    global.conn.collection("cnpjs").updateOne(
      { cnpj },
      {
        $set: item
      },
      callback
    );
  }

  function deleteOne(cnpj, callback) {
  global.conn
    .collection("cnpjs")
    .deleteOne({ cnpj }, callback);
}

export default { findAll, updateOne, deleteOne }