const express = require("express");
const app = express();
const { Pool } = require("pg");
const cors = require("cors");
const session = require('express-session')
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { format } = require('pg-format');

const sgMail = require("@sendgrid/mail");
require("dotenv").config();

app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
}));
app.set('trust proxy', 1)
app.use(session({
    secret: 'qqb',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, sameSite: "lax"},
    
}))

app.listen(3002, () => {
  console.log("Server is running on port 3002 🚀");
});

const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "1234",
  });


  app.post("/register", (req, res) => {
    const sentEmail = req.body.Email;
    const sentNome = req.body.Nome;
    const sentSenha = req.body.Senha;
    const sentCelular = req.body.Celular;
  
    const SQL =
      "INSERT INTO users (email, nome, senha, celular) VALUES ($1, $2, $3, $4)";
    const values = [sentEmail, sentNome, sentSenha, sentCelular];
  
    pool.query(SQL, values, (err, results) => {
      if (err) {
        console.error("Error inserting user:", err);
        res.send({ error: "Error inserting user" });
      } else {
        console.log("User inserted successfully!");
        res.send({ message: "User added!" });
      }
    });
  });

// Defina a rota para a verificação da senha
app.get('/password', async (req, res) => {
  try {
    // Faça a consulta no banco de dados para obter a senha do usuário
    const result = await pool.query('SELECT senha FROM users WHERE id = $1', [1]); // Substitua "userId" pelo ID do usuário

    if (result.rows.length === 0) {
      // Usuário não encontrado, retorne um erro
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Extraia a senha do resultado da consulta
    const storedPassword = result.rows[0].senha;

    // Retorne a senha como resposta
    res.json({ password: storedPassword });
  } catch (error) {
    console.error('Erro ao verificar a senha:', error);
    res.status(500).json({ error: 'Erro ao verificar a senha' });
  }
});

  app.post('/login', (req, res) => {
    const sentLoginEmail = req.body.LoginEmail;
    const sentLoginSenha = req.body.LoginSenha;
    
    const SQL = 'SELECT * FROM users WHERE email = $1 AND senha = $2';
    const values = [sentLoginEmail, sentLoginSenha];
    
    pool.query(SQL, values, (err, results) => {
      if (err) {
        res.status(500).send({ error: err });
      }
      if (results.rowCount > 0) {
        const user = results.rows[0]
        req.session.userId = user.id
        console.log("==>", req.session.userId )
        res.status(200).json(user);
        
      } else {
        res.status(401).json({ message: 'Credenciais não correspondem!' });
      }
    });
  });

  // Update user
  app.put("/profile", (req, res) => {
      const userId = req.session.userId;
    if (!userId) {
       return res.status(401).send();
      }
    const updatedEmail = req.body.Email;
    const updatedNome = req.body.Nome;
    const updatedCelular = req.body.Celular;
    
  
    const SQL = "UPDATE users SET email = $1, nome = $2, celular = $3 WHERE id = $4";
    const values = [updatedEmail, updatedNome, updatedCelular, userId];
  
    pool.query(SQL, values, (err, results) => {
      if (err) {
        console.error("Error updating user:", err);
        res.send({ error: "Error updating user" });
      } else {
        console.log("User updated successfully!");
        res.send({ message: "User updated!" });
      }
    });
  });

  app.get('/userinfo', async (req, res) => {
  try {
    // Faça a consulta no banco de dados para obter as informações do usuário
    const result = await pool.query('SELECT email, nome, celular FROM users WHERE id = $1', [1]); // Substitua "userId" pelo ID do usuário

    if (result.rows.length === 0) {
      // Usuário não encontrado, retorne um erro
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Extraia as informações do resultado da consulta
    const { email, nome, celular } = result.rows[0];

    // Retorne as informações como resposta
    res.json({ email, nome, celular });
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    res.status(500).json({ error: 'Erro ao obter informações do usuário' });
  }
});

app.put('/update-password', async (req, res) => {
  try {
    const { senha } = req.body; // Obtenha a senha do corpo da requisição

    // Realize a atualização da senha no banco de dados
    const query = 'UPDATE users SET senha = $1 WHERE id = $2';
    const values = [senha, 1]; // Substitua "req.user.id" pelo ID do usuário que deseja atualizar a senha

    await pool.query(query, values);

    res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar a senha:', error);
    res.status(500).json({ error: 'Erro ao atualizar a senha' });
  }
});


  app.put("/password", (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).send();
    }
    const currentSenha = req.body.currentSenha; // Senha atual recebida no input
    const updatedSenha = req.body.updatedSenha; // Nova senha recebida no input
    
    // Primeiro, verifique se a senha atual do usuário corresponde à senha armazenada no banco de dados
    const SQLSelect = "SELECT senha FROM users WHERE id = $1";
    const selectValues = [userId];
  
    pool.query(SQLSelect, selectValues, (err, results) => {
      if (err) {
        console.error("Error selecting user:", err);
        res.send({ error: "Error selecting user" });
      } else {
        const user = results.rows[0];
        if (user.senha !== currentSenha) {
          // Senha atual não corresponde, retorne um erro
          res.status(401).json({ message: "Senha atual incorreta!" });
        } else {
          // A senha atual corresponde, execute a atualização da senha
          const SQLUpdate = "UPDATE users SET senha = $1 WHERE id = $2";
          const updateValues = [updatedSenha, userId];
        
          pool.query(SQLUpdate, updateValues, (err, results) => {
            if (err) {
              console.error("Error updating password:", err);
              res.send({ error: "Error updating password" });
            } else {
              console.log("Password updated successfully!");
              res.send({ message: "Password updated!" });
            }
          });
        }
      }
    });
  });

  //Adiciona mensagem na area Suporte
  app.post("/support", (req, res) => {
    const sentTitulo = req.body.Titulo;
    const sentMensagem = req.body.Mensagem;
  
    //Realiza a requisição SQL no banco
    const SQL =
      "INSERT INTO suporte (titulo, mensagem) VALUES ($1, $2)";
    const values = [sentTitulo, sentMensagem];
  
    //Tratamento dos possiveis erros ao acessar o banco
    pool.query(SQL, values, (err, results) => {
      if (err) {
        console.error("Error inserting data:", err);
        res.send({ error: "Error inserting data" });
      } else {
        console.log("Data inserted successfully!");
        res.send({ message: "Data added!" });
      }
    });
  });
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  app.post("/forgot-password", async (req, res) => {
    try {
      const { email, recoveryLink } = req.body;
  
      // Configurar o email
      const msg = {
        to: email,
        from: process.env.EMAIL_FROM,
        subject: "Recuperação de Senha",
        html: `
          <p>Olá,</p>
          <p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir sua senha:</p>
          <a href="${recoveryLink}">${recoveryLink}</a>
          <p>Se você não solicitou a recuperação de senha, ignore este email.</p>
        `,
      };
  
      // Enviar o email usando o SendGrid
      await sgMail.send(msg);
  
      console.log("Email de recuperação de senha enviado com sucesso!");
      res.status(200).json({ message: "Email de recuperação de senha enviado com sucesso!" });
    } catch (error) {
      console.error("Erro ao enviar o email de recuperação de senha:", error);
      res.status(500).json({ error: "Erro ao enviar o email de recuperação de senha. Por favor, tente novamente mais tarde." });
    }
  });

  let tableNameGlobal = '';
  let filePathGlobal = '';
  
  app.post('/create-table', upload.single('file'), (req, res) => {
    tableNameGlobal = req.body.nameTable;
    filePathGlobal = req.file.path;
  
    // Criação da tabela
    const createTableQuery = `CREATE TABLE ${tableNameGlobal} (id SERIAL PRIMARY KEY)`;
  
    pool.query(createTableQuery, (err, result) => {
      if (err) {
        console.error('Error creating table:', err);
        res.status(500).send({ error: 'Error creating table' });
      } else {
        console.log(`Table "${tableNameGlobal}" created successfully!`);
  
        res.send({ message: `Table "${tableNameGlobal}" created successfully!`, result: [tableNameGlobal, filePathGlobal] });
      }
    });
  });
  
  app.get('/get-table-info', (req, res) => {
    res.send({ tableName: tableNameGlobal, filePath: filePathGlobal });
  });

  app.get('/table-list', async (req, res) => {
    try {
      const client = await pool.connect();
  
      // Consulta SQL para obter todas as tabelas, exceto "user" e "suporte"
      const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name NOT IN ('users', 'suporte')
      `;
  
      const result = await client.query(query);
      const tabelas = result.rows.map(row => row.table_name);
  
      client.release();
  
      res.json(tabelas);
    } catch (error) {
      console.error('Erro ao obter as tabelas do banco de dados:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

 
  app.post('/add-record', upload.single('arquivo'), async (req, res) => {
    try {
      const tabela = req.body.tabela;
      const arquivo = req.file;
  
      if (!arquivo) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
      }
  
      // Verificar a extensão do arquivo (opcional)
      const extensao = arquivo.originalname.split('.').pop();
      if (extensao !== 'csv') {
        return res.status(400).json({ error: 'Formato de arquivo inválido. Por favor, envie um arquivo CSV.' });
      }
  
      // Lógica para ler o arquivo CSV e adicionar os dados na tabela selecionada
      const dados = [];
      fs.createReadStream(arquivo.path)
        .pipe(csv())
        .on('data', (data) => {
          // Adicionar os dados em um array
          dados.push(data);
        })
        .on('end', () => {
          // Inserir os dados na tabela
          const insertPromises = dados.map((row) => {
            const columns = Object.keys(row);
            const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
            const values = Object.values(row);
            const insertQuery = `INSERT INTO ${tabela} (${columns.join(', ')}) VALUES (${placeholders})`;
  
            return new Promise((resolve, reject) => {
              pool.query(insertQuery, values, (err, result) => {
                if (err) {
                  console.error('Erro ao inserir dados na tabela:', err);
                  reject(err);
                } else {
                  resolve(result);
                }
              });
            });
          });
  
          Promise.all(insertPromises)
            .then(() => {
              res.status(200).json({ message: 'Registros adicionados com sucesso' });
            })
            .catch((error) => {
              console.error('Erro ao adicionar registros:', error);
              res.status(500).json({ error: 'Erro interno do servidor' });
            });
        });
    } catch (error) {
      console.error('Erro ao adicionar registros:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  

  app.post('/process-table', (req, res) => {
    const { tableName, filePath } = req.body;
  
    // Lendo o conteúdo do arquivo CSV
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Extrair as colunas do arquivo CSV
        const columns = Object.keys(results[0]);
  
        // Montar a query de criação das colunas
        let alterTableQuery = `ALTER TABLE ${tableName}`;
        columns.forEach((column) => {
          alterTableQuery += ` ADD COLUMN ${column} VARCHAR(255),`;
        });
        alterTableQuery = alterTableQuery.slice(0, -1); // Remover a última vírgula
        alterTableQuery += ';';
  
        // Executar a query de alteração da tabela
        pool.query(alterTableQuery, (err, result) => {
          if (err) {
            console.error('Erro ao alterar a tabela:', err);
            res.status(500).send({ error: 'Erro ao alterar a tabela' });
          } else {
            // Inserir os dados na tabela
            const placeholders = results.map((_, index) => `(${columns.map((_, columnIndex) => `$${index * columns.length + columnIndex + 1}`).join(', ')})`).join(', ');
            const insertQuery = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
            const values = results.flatMap(row => Object.values(row));
  
            pool.query(insertQuery, values, (err, result) => {
              if (err) {
                console.error('Erro ao inserir dados na tabela:', err);
                res.status(500).send({ error: 'Erro ao inserir dados na tabela' });
              } else {
                console.log(`Dados inseridos na tabela "${tableName}" com sucesso!`);
                res.send({ message: `Dados inseridos na tabela "${tableName}" com sucesso!` });
              }
            });
          }
        });
      });
  });

  app.post('/replace-records', upload.single('arquivo'), async (req, res) => {
    try {
      const tabela = req.body.tabela;
      const arquivo = req.file;
  
      if (!arquivo) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
      }
  
      // Verificar a extensão do arquivo (opcional)
      const extensao = arquivo.originalname.split('.').pop();
      if (extensao !== 'csv') {
        return res.status(400).json({ error: 'Formato de arquivo inválido. Por favor, envie um arquivo CSV.' });
      }
  
      // Lógica para ler o arquivo CSV e adicionar os dados na tabela selecionada
      const dados = [];
      fs.createReadStream(arquivo.path)
        .pipe(csv())
        .on('data', (data) => {
          // Adicionar os dados em um array
          dados.push(data);
        })
        .on('end', () => {
          // Limpar registros existentes na tabela
          pool.query(`DELETE FROM ${tabela}`, (err, result) => {
            if (err) {
              console.error('Erro ao limpar registros da tabela:', err);
              return res.status(500).json({ error: 'Erro interno do servidor' });
            }
  
            // Inserir os dados na tabela
            const insertPromises = dados.map((row) => {
              const columns = Object.keys(row);
              const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
              const values = Object.values(row);
              const insertQuery = `INSERT INTO ${tabela} (${columns.join(', ')}) VALUES (${placeholders})`;
  
              return new Promise((resolve, reject) => {
                pool.query(insertQuery, values, (err, result) => {
                  if (err) {
                    console.error('Erro ao inserir dados na tabela:', err);
                    reject(err);
                  } else {
                    resolve(result);
                  }
                });
              });
            });
  
            Promise.all(insertPromises)
              .then(() => {
                res.status(200).json({ message: 'Registros substituídos com sucesso' });
              })
              .catch((error) => {
                console.error('Erro ao substituir registros:', error);
                res.status(500).json({ error: 'Erro interno do servidor' });
              });
          });
        });
    } catch (error) {
      console.error('Erro ao substituir registros:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  

  // Delete user
  app.delete("/users/:id", (req, res) => {
    const userId = req.params.id;
  
    const SQL = "DELETE FROM users WHERE id = $1";
    const values = [userId];
  
    pool.query(SQL, values, (err, results) => {
      if (err) {
        console.error("Error deleting user:", err);
        res.send({ error: "Error deleting user" });
      } else {
        console.log("User deleted successfully!");
        res.send({ message: "User deleted!" });
      }
    });
  });
  
  
  