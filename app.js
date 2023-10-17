const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;
var loggedinuser="";
var article_id=1;
app.use(bodyParser.json());
app.use(cors());
const db = new sqlite3.Database('news_portal.db');

//Fetching article on the homepage
app.get('/articles', (req, res) => {
  const query = "select a.title as title,a.content as content,u.f_name||' '||u.l_name as author,category,published_date from articles a JOIN users u on a.author=u.username order by published_date DESC";
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch articles.' });
    } else {
      res.status(200).json(rows);
    }
  });
});

//fetching category wise articles on homepage
app.get('/catarticles', (req, res) => {
  const category = req.query.category;
  if (category) {
    const query = "select a.title as title,a.content as content,u.f_name||' '||u.l_name as author,category,published_date from articles a JOIN users u on a.author=u.username and category=? order by published_date DESC";
    db.all(query, [category], (err, rows) => {
      if (err) {
        console.error('Error fetching news by category:', err);
        res.status(500).json({ error: 'Failed to fetch news articles.' });
      } else {
        res.status(200).json(rows);
      }
    });
  } else {
    res.status(400).json({ error: 'Category not provided.' });
  }
});

//fetching last 24 hrs articles
app.get('/latest-articles', (req, res) => {
  const query = "select a.title as title,a.content as content,u.f_name||' '||u.l_name as author,category,published_date from articles a JOIN users u on a.author=u.username where  published_date > datetime('now', '-1 day') order by published_date DESC";
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error fetching latest news:', err);
      res.status(500).json({ error: 'Failed to fetch latest news articles.' });
    } else {
      res.status(200).json(rows);
    }
  });
});

//fetch the searched article
app.get('/searcharticles', async (req, res) => {
  try {
    const query = req.query.q || '';
    const query1 = `select a.title as title,a.content as content,u.f_name||' '||u.l_name as author,category,published_date from articles a JOIN users u on a.author=u.username WHERE title LIKE '%${query}%' OR content LIKE '%${query}%' OR category LIKE '%${query}%' order by published_date DESC`;
      db.all(query1, (err, rows) => {
        if (err) {
          console.error('Error fetching latest news:', err);
          res.status(500).json({ error: 'Failed to fetch latest news articles.' });
        } else {
          res.status(200).json(rows);
        }
      });
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles.' });
  }
});

//Registering New User
app.post('/register', async (req, res) => {
  const { username,f_name,l_name, email, mobile_no, password,login_type } = req.body;
  if (!username || !password || !login_type) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const query = 'SELECT * FROM users WHERE username = ?';
    const existingUser = await new Promise((resolve, reject) => {
      db.get(query, [username], (err, user) => {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const active="True";
    const insertQuery = 'INSERT INTO users (username,f_name,l_name,email,phone,password_hash,account_type,active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    await new Promise((resolve, reject) => {
      db.run(insertQuery, [username,f_name,l_name,email,mobile_no, hashedPassword,login_type,active], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.status(200).json({ message: 'Registration successful!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

//Login to the App
app.post('/login', (req, res) => {
  const { username, password,login_type} = req.body;
 
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const active="True";
  const query = 'SELECT username, password_hash FROM users WHERE username = ? and account_type = ? and active = ?';
  db.get(query, [username,login_type,active], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    bcrypt.compare(password, user.password_hash, (bcryptErr, result) => {
      if (bcryptErr) {
        return res.status(500).json({ error: 'Internal server error.' });
      }
      if (!result) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
      loggedinuser=username;
      return res.status(200).json({user: loggedinuser,message: 'Login successful!' }); 
    });
  });
});


//Submitting the new Article
app.post('/submit-article', async (req, res) => {
    var { category, title, content} = req.body;
    author=loggedinuser;
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'Category, title, content, Image are required.' });
    }
  
    try {
      const insertQuery = 'INSERT INTO articles (category, title, content, author) VALUES (?, ?, ?, ?)';
      await new Promise((resolve, reject) => {

        db.run(insertQuery, [category, title, content, author], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      res.status(200).json({ user: loggedinuser,message: ' Article submitted successfully!' });
    } catch (error) {
      console.error('Article submission error:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

//Submitting the new Advertisement
app.post('/submit-advertisement', async (req, res) => {
  var { category, title, content,end_date,priority} = req.body;
  author=loggedinuser;
  if (!category || !title || !content ||!end_date || !priority) {
    return res.status(400).json({ error: 'Category, title, content,end_date,priority are required.' });
  }

  try {
    const insertQuery = 'INSERT INTO advertisement (category, title, content, author,end_date,priority) VALUES (?, ?, ?, ?,?,?)';
    await new Promise((resolve, reject) => {

      db.run(insertQuery, [category, title, content, author, end_date,priority], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.status(200).json({ user: loggedinuser,message: ' Ad submitted successfully!' });
  } catch (error) {
    console.error('Ad submission error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


//Fetching the Advertisements on the Ads homepage
app.get('/get_ads', (req, res) => {
  
  const query = "select a.title as title,a.content as content,a.category from advertisement a JOIN users u on a.author=u.username order by priority,published_date DESC";
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch articles.' });
    } else {
      res.status(200).json(rows);
    }
  });
});

//Fetching the articles for a specific author for modification
app.get('/author-articles', (req, res) => {

  console.log("Loggedinuser : ",loggedinuser);
  if (loggedinuser) {
    const query = "select a.article_id as article_id,a.title as title,a.content as content,a.category as category, author from articles a JOIN users u on a.author=u.username WHERE a.author=? order by published_date DESC";
    db.all(query, [loggedinuser], (err, rows) => {
      if (err) {
        console.error('Error fetching news by Author:', err);
        res.status(500).json({ error: 'Failed to fetch news articles.' });
      } else {
        res.status(200).json(rows);
        
      }
    });
  } else {
    res.status(400).json({ error: 'Author not provided.' });
  }
});


//Fetching the articles for the specific article ID for update
app.get('/modify_article', (req, res) => {
  article_id = req.query.article_id;
  
  
  if (article_id) {
    const query = "SELECT article_id as id , title,content,category,published_date from articles WHERE article_id=?";
    db.all(query,[article_id], (err, rows) => {
      if (err) {
        console.error('Error fetching news by category:', err);
        res.status(500).json({ error: 'Failed to fetch articles.' });
      } else {
        
        res.status(200).json(rows);
        
      }
    });
  } else {
    res.status(400).json({ error: 'Article ID not provided.' });
  }
});

// Update the article and submit in the DB
app.post('/update-article', async (req, res) => {
  var { category, title, content,article_id} = req.body;
  author=loggedinuser;
  if (!category || !title || !content) {
    return res.status(400).json({ error: 'Category, title, content are required.' });
  }

  try {
    const insertQuery = 'UPDATE articles SET category = ?, title = ?, content = ?, author=? WHERE article_id = ?';
    await new Promise((resolve, reject) => {

      db.run(insertQuery, [category, title, content, author, article_id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.status(200).json({ user: loggedinuser,message: ' Article submitted successfully!' });
  } catch (error) {
    console.error('Article submission error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

//Fetch author details for modification
app.get('/modify_author', (req, res) => {
  
  
  const author=loggedinuser;
  
  if (author) {
    const query = "SELECT username,f_name,l_name, phone,email from users WHERE username=?";
    db.all(query,[author], (err, rows) => {
      if (err) {
        console.error('Error fetching details of the Author: ', err);
        res.status(500).json({ user: loggedinuser, error: 'Failed to fetch details.' });
      } else {
        
        res.status(200).json(rows);
        
      }
    });
  } else {
    res.status(400).json({ user: loggedinuser, error: 'Author details absent' });
  }
});

//Update the details of the author in the DB
app.post('/update_author', async (req, res) => {
  var { f_name, l_name, phone,email} = req.body;
  var author=loggedinuser;
  if (!f_name || !l_name || !phone || !email) {
    return res.status(400).json({ error: 'First & Last name, Phone No., Email are required.' });
  }

  try {
    const insertQuery = 'UPDATE users SET f_name = ?, l_name = ?, phone = ?, email=? WHERE username = ?';
    await new Promise((resolve, reject) => {

      db.run(insertQuery, [f_name, l_name, phone,email,author], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.status(200).json({user: loggedinuser, message: 'Details updated successfully!' });
  } catch (error) {
    console.error('Details submission error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

//Fetch the advertisement for update
app.get('/author-ads', (req, res) => {

 // console.log("Loggedinuser : ",loggedinuser);
  if (loggedinuser) {
    const query = "select a.ad_id as ad_id,a.title as title,a.content as content,a.category as category,a.priority as priority, author, a.end_date from advertisement a JOIN users u on a.author=u.username WHERE a.author=? order by published_date DESC";
    db.all(query, [loggedinuser], (err, rows) => {
      if (err) {
        console.error('Error fetching news by Author:', err);
        res.status(500).json({ error: 'Failed to fetch Advertisement' });
      } else {
        res.status(200).json(rows);
        
      }
    });
  } else {
    res.status(400).json({ error: 'Author not provided.' });
  }
});

//fetch the advertisement details for editing/modification
app.get('/modify_ad', (req, res) => {
  ad_id = req.query.ad_id;
  
  
  if (article_id) {
    const query = "SELECT ad_id as id , title,content,category,published_date,author from advertisement WHERE ad_id=?";
    db.all(query,[ad_id], (err, rows) => {
      if (err) {
        console.error('Error fetching news by category:', err);
        res.status(500).json({ error: 'Failed to fetch ads.' });
      } else {
        
        res.status(200).json(rows);
        
      }
    });
  } else {
    res.status(400).json({ error: 'ad ID not provided.' });
  }
});

//updating the ad in the DB
app.post('/update-ad', async (req, res) => {
  var { category, title, content,end_date,priority, ad_id} = req.body;
  author=loggedinuser;
  if (!category || !title || !content) {
    return res.status(400).json({ error: 'Category, title, content are required.' });
  }

  try {
    const insertQuery = 'UPDATE advertisement SET category = ?, title = ?, content = ?, author=?, end_date=?, priority=? WHERE ad_id = ?';
    await new Promise((resolve, reject) => {

      db.run(insertQuery, [category, title, content, author,end_date,priority, ad_id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.status(200).json({ user: loggedinuser,message: ' Ad updated successfully!' });
  } catch (error) {
    console.error('Ad submission error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


// DELETE endpoint for articles
app.delete('/delete-article/:article_id', (req, res) => {
  const articleId = req.params.article_id;

  if (!articleId) {
    return res.status(400).json({ error: 'Article ID not provided.' });
  }

  const deleteQuery = 'DELETE FROM articles WHERE article_id = ?';

  db.run(deleteQuery, [articleId], (err) => {
    if (err) {
      console.error('Error deleting article:', err);
      return res.status(500).json({ error: 'Failed to delete the article.' });
    }

    res.status(200).json({ message: 'Article deleted successfully!' });
  });
});

// DELETE endpoint for ads
app.delete('/delete-ad/:ad_id', (req, res) => {
  const adId = req.params.ad_id;

  if (!adId) {
    return res.status(400).json({ error: 'Ad ID not provided.' });
  }

  const deleteQuery = 'DELETE FROM advertisement WHERE ad_id = ?';
  db.run(deleteQuery, [adId], (err) => {
    if (err) {
      console.error('Error deleting Ad:', err);
      return res.status(500).json({ error: 'Failed to delete the Ad.' });
    }
    res.status(200).json({ message: 'Ad deleted successfully!' });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});