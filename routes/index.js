var express    = require('express'),
    router     = express.Router(),
    xml2js     = require('xml2js'),
    rest       = require('restler'),
    crypto     = require('crypto'),
    mongoose   = require('mongoose'),
    Schema     = mongoose.Schema,
    moment     = require('moment'),
    nodemailer = require('nodemailer'),
    xmlparser  = require('express-xml-bodyparser'),
    reg        = {},
    status     = {};

status = {
  'new'        : 'новый',
  'accepted'   : 'в обработке',
  'approved'   : 'согласован',
  'dispatched' : 'отгружен',
  'delivered'  : 'доставлен',
  'declined'   : 'отменён'
};

var transport = nodemailer.createTransport("SMTP", {
  service: "Gmail",
  auth: {
    user: process.env.EMAILLOGIN,
    pass: process.env.EMAILPASS
  }
});

/* GET home page. */
router.get('/', function(req, res) {
  if (req.cookies.email == undefined || req.cookies.pass == undefined){
    res.render('index', { title: 'Партнёрская программа m-kama.ru' });
  } else {
    reg.autoLogin(res, req.cookies.email.toLowerCase(), req.cookies.pass, function(o){
      if (o !== null) {
        req.session.email = o;
        res.redirect('/dashboard');
      } else {
        res.render('index', { title: 'Партнёрская программа m-kama.ru' });
      }
    });
  }
});

router.post('/', function(req, res) {
  reg.manualLogin(res, req.param('email').toLowerCase(), req.param('pass'), function(e, o){
    if (!o){
      res.send(e, 400);
    } else {
      req.session.email = o;
      res.cookie('email', o.email, { maxAge: 900000 });
      res.cookie('pass', o.pass, { maxAge: 900000 });
      res.redirect('/dashboard');
      //res.send(o, 200); для проверки что возвращается именно того пользователя
    }
  });
});

router.get('/admin', function(req, res) {
  if (req.session.email.admin) {
    var page = req.query.p;
    var per_page = 10;
    if (page == null) {
      page = 0;
    }
    Users.find({}, {}, { sort: { 'partnerid' : -1 }, skip: page*per_page, limit: per_page }, function(e, o) {
      Users.count({}, function(err, count) {
        res.render('admin', {
          title    : 'Панель администратора m-kama.ru',
          users    : o,
          count    : count,
          page     : page,
          per_page : per_page,
          moment   : moment
        });
      });
    });
  } else {
    res.redirect('/dashboard');
  }
});

router.get('/admin/:partnerid', function(req, res) {
  if (req.session.email.admin) {
    var fr,to,st;
    var page = req.query.p;
    var per_page;
    if (page == null) {
      page = 0;
    }
    if (req.query.fr) {
      fr = moment(req.query.fr, "DD.MM.YYYY");
    } else {
      fr = new Date(1970, 01, 01);
    }
    if (req.query.to) {
      to = moment(req.query.to, "DD.MM.YYYY");
    } else {
      to = new Date(2100, 01, 01);
    }
    if (status[req.query.st]) {
      st = req.query.st;
    } else {
      st = {$not: {$size: 0}};
    }
    if ((to.toISOString() == new Date(2100, 01, 01).toISOString())&&(fr.toISOString() == new Date(1970, 01, 01).toISOString())&&(!status[req.query.st])) {
      per_page = 10;
    } else {
      per_page = 1000000;
    }
    Users.findOne({partnerid:req.param('partnerid')}, function(ue, uo) {
      Orders.count({partnerid: uo.partnerid}, function(err, count) {
        Orders.find({partnerid: uo.partnerid, 'created_at': {'$gte': fr, '$lt': to}, status: st}, {}, { sort: { 'created_at' : -1 }, skip: page*per_page, limit: per_page }, function(e, o) {
          res.render('dashboardadmin', {
            title    : 'Партнёрская панель m-kama.ru',
            orders   : o,
            count    : count,
            page     : page,
            per_page : per_page,
            unique   : uo.unique,
            moment   : moment,
            status   : status,
            id       : uo.partnerid,
            url      : process.env.insalesurl
          });
        });
      });
    });
  } else {
    res.redirect('/dashboard');
  }
});

router.get('/admin/disable/:partnerid', function(req, res) {
  if (req.session.email.admin) {
    Users.findOne({partnerid:req.param('partnerid')}, function(e, o) {
      o.enabled = false;
      o.save(function (err) {
        if (err) {
          res.send(e, 400);
        } else {
          res.redirect('/admin');
        }
      });
    });
  } else {
    res.redirect('/admin');
  }
});

router.get('/admin/enable/:partnerid', function(req, res) {
  if (req.session.email.admin) {
    Users.findOne({partnerid:req.param('partnerid')}, function(e, o) {
      o.enabled = true;
      o.save(function (err) {
        if (err) {
          res.send(e, 400);
        } else {
          res.redirect('/admin');
        }
      });
    });
  } else {
    res.redirect('/admin');
  }
});

router.get('/signup', function(req, res) {
  res.render('signup', { title: 'Регистрация' });
});

router.post('/signup', function(req, res) {
  reg.addNewAccount(res, {
    email : req.param('email')
  }, function(e) {
       if (e) {
         res.send(e, 400);
       } else {
         res.send('ok', 200);
       }
     });
});

router.get('/logout', function(req, res) {
  if (req.session) {
    req.session.destroy(function() {
      res.clearCookie('email', { path: '/' });
      res.clearCookie('pass', { path: '/' });
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

router.get('/emailtaken', function(req, res) {
  res.render('emailtaken', { title: 'Адрес электронной почты уже занят' });
});

router.get('/invalidpassword', function(req, res) {
  res.render('invalidpassword', { title: 'Неправильный пароль' });
});

router.get('/usernotfound', function(req, res) {
  res.render('usernotfound', { title: 'Пользователь не найден' });
});

router.get('/regerror', function(req, res) {
  res.render('regerror', { title: 'Произошла ошибка' });
});

router.get('/reset', function(req, res) {
  res.render('reset', { title: 'Сброс пароля' });
});

router.post('/reset', function(req, res) {
  reg.updatePassword(res, {
    email : req.param('email')
  }, function(e) {
       if (e) {
         res.send(e, 400);
       } else {
         res.send('ok', 200);
       }
     });
});

router.get('/complete', function(req, res) {
  res.render('complete', { title: 'Регистрация завершена' });
});

router.get('/disabled', function(req, res) {
  res.render('disabled', { title: 'Ваш аккаунт выключен' });
});

router.get('/dashboard', function(req, res) {
  if (req.session.email) {
    if (req.session.email.admin) {
      res.redirect('/admin');
    } else {
      var fr,to,st;
      var page = req.query.p;
      var per_page;
      if (page == null) {
        page = 0;
      }
      if (req.query.fr) {
        fr = moment(req.query.fr, "DD.MM.YYYY");
      } else {
        fr = new Date(1970, 01, 01);
      }
      if (req.query.to) {
        to = moment(req.query.to, "DD.MM.YYYY");
      } else {
        to = new Date(2100, 01, 01);
      }
      if (status[req.query.st]) {
        st = req.query.st;
      } else {
        st = {$not: {$size: 0}};
      }
      if ((to.toISOString() == new Date(2100, 01, 01).toISOString())&&(fr.toISOString() == new Date(1970, 01, 01).toISOString())&&(!status[req.query.st])) {
        per_page = 10;
      } else {
        per_page = 1000000;
      }
      Users.findOne({partnerid:req.session.email.partnerid}, function(ue, uo) {
        Orders.count({partnerid: uo.partnerid}, function(err, count) {
          Orders.find({partnerid: uo.partnerid, 'created_at': {'$gte': fr, '$lt': to}, status: st}, {}, { sort: { 'created_at' : -1 }, skip: page*per_page, limit: per_page }, function(e, o) {
            res.render('dashboard', {
              title    : 'Партнёрская панель m-kama.ru',
              orders   : o,
              count    : count,
              page     : page,
              per_page : per_page,
              unique   : uo.unique,
              moment   : moment,
              status   : status,
              id       : uo.partnerid,
              url      : process.env.insalesurl
            });
          });
        });
      });
    }
  } else {
    res.redirect('/');
  }
});

router.get('/unique/:partnerid', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
  console.log(req.param('partnerid'));
  Users.findOne({partnerid:req.param('partnerid')}, function(e, o) {
    if (o) {
      if (o.enabled) {
        o.unique = o.unique + 1;
        o.save(function (err) {
          if (err) {
            res.send(e, 400);
          } else {
            res.send(200);
          }
        });
      } else {
        res.send(200);
      }
    } else {
      res.send(200);
    }
  });
});

router.get('/check/:partnerid/:orderid', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
  console.log(req.param('partnerid'));
  console.log(req.param('orderid'));
  Users.findOne({partnerid:req.param('partnerid'), enabled: true}, function(e, u) {
    if (u) {
      Orders.findOne({orderid:req.param('orderid')}, function(err, order) {
        if (order !== null) {
          res.send(200);
        } else {
          rest.get('http://' + process.env.insalesid + ':' + process.env.insalessecret + '@' + process.env.insalesurl + '/admin/orders/' + req.param('orderid') + '.xml').once('complete', function(order) {
            if (order instanceof Error) {
              console.log('Error: ' + order.message);
              res.send(200);
            } else {
              var sum = 0;
              order['order']['order-lines'][0]['order-line'].forEach(function (value, index) {
                sum = sum + parseInt(value.quantity[0]._);
              });
              var o = new Orders({
                orderid    : order['order'].id[0]._,
                number     : order['order'].number[0]._,
                partnerid  : u.partnerid,
                sum        : parseFloat(order['order']['items-price'][0]._),
                quantity   : sum,
                status     : order['order']['fulfillment-status'][0],
                comment    : order['order'].comment[0],
                created_at : moment(new Date(order['order']['created-at'][0]._)).format(),
                updated_at : moment(new Date(order['order']['updated-at'][0]._)).format(),
                enabled    : true
              });
              order['order']['order-lines'][0]['order-line'].forEach(function (value, index) {
                o.items.push({
                  itemid    : value.id[0]._,
                  productid : value['product-id'][0]._,
                  name      : value.title[0],
                  quantity  : value.quantity[0]._,
                  sum       : parseInt(value['sale-price'][0]._)
                });
              });
              o.save(function (err) {
                if (err) {
                  console.log(err);
                  res.send(200);
                } else {
                  u.orders = u.orders + 1;
                  u.save(function (err) {
                    if (err) {
                      res.send(e, 400);
                    } else {
                      res.send(200);
                    }
                  });
                }
              });
            }
          });
        }
      });
    } else {
      res.send(200);
    }
  });
});

router.post('/order/update', xmlparser({trim: false, explicitArray: false}), function(req, res) {
  Orders.findOne({orderid:req.body.order.id[0]._}, function(err, order) {
    if (order == null) {
      res.send(200);
    } else {
      rest.get('http://' + process.env.insalesid + ':' + process.env.insalessecret + '@' + process.env.insalesurl + '/admin/orders/' + req.body.order.id[0]._ + '.xml').once('complete', function(o) {
        Orders.findOne({orderid:o.order.id[0]._}, function(err, order) {
          if (err || order == null) {
            console.log(err);
            res.send(200);
          } else {
            order.status = o.order['fulfillment-status'][0];
            order.comment = o.order.comment[0];
            order.updated_at = moment(new Date(o['order']['updated-at'][0]._)).format();
            order.save(function (err) {
              if (err) {
                console.log(err);
                res.send(200);
              } else {
                res.send(200);
              }
            });
          }
        });
      });
    }
  });
});

module.exports = router;

//registration

reg.autoLogin = function(res, email, pass, callback) {
  Users.findOne({email:email}, function(e, o) {
    if (o) {
      if (o.enabled) {
        o.pass == pass ? callback(o) : callback(null);
      } else {
        res.redirect('/disabled');
      }
    } else {
      callback(null);
    }
  });
}

reg.manualLogin = function(res, email, pass, callback) {
  Users.findOne({email:email}, function(e, o) {
    if (o == null) {
      res.redirect('/usernotfound');
    } else {
      if (o.enabled) {
        validatePassword(pass, o.pass, function(e, chk) {
          if (chk) {
            callback(null, o);
          } else {
            res.redirect('/invalidpassword');
          }
        });
      } else {
        res.redirect('/disabled');
      }
    }
  });
}

reg.addNewAccount = function(res, newData, callback) {
  Users.findOne({email:newData.email}, function(e, o) {
    if (o) {
      res.redirect('/emailtaken');
    } else {
      var pass = generateSalt();
      console.log(pass);
      var message = {
        from: 'Партнёрская программа m-kama.ru <robot@sovechkin.com>',
        to: newData.email,
        replyTo: 'm-kama-svetlana@ya.ru',
        subject: 'Регистрация',
        text: 'Ваш логин: ' + newData.email + '\nВаш пароль: ' + pass + '\n\nВойти в панель можно здесь http://m-kama.ru/page/partners\n\nВаша партнёрская ссылка находится внутри панели.'
      };
      transport.sendMail(message, function(error) {
        if(error){
          console.log(error.message);
          res.redirect('/regerror');
        } else {
          transport.close();
          saltAndHash(pass, function(hash) {
            Users.findOne({}, {}, { sort: { 'created_at' : -1 } }, function(err, userid) {
              if (userid == null) {
                newData.partnerid  = 1000;
              } else {
                newData.partnerid  = userid.partnerid + 1;
              }
              newData.pass       = hash;
              if (newData.partnerid == 1000) {
                newData.admin      = 1;
              } else {
                newData.admin      = 0;
              }
              newData.orders     = 0;
              newData.unique     = 0;
              newData.created_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
              newData.updated_at = newData.created_at;
              newData.enabled    = 1;
              console.log(newData);
              var user = new Users(newData);
              user.save(function (err) {
                if (err) {
                  res.send(e, 400);
                } else {
                  res.redirect('/complete');
                }
              });
            });
          });
        }
      });
    }
  });
}

reg.updatePassword = function(res, newData, callback) {
  Users.findOne({email:newData.email}, function(e, o) {
    if (o == null) {
      res.redirect('/usernotfound');
    } else {
      var pass = generateSalt();
      console.log(pass);
      var message = {
        from: 'Партнёрская программа m-kama.ru <robot@sovechkin.com>',
        to: o.email,
        replyTo: 'm-kama-svetlana@ya.ru',
        subject: 'Ваш новый пароль',
        text: 'Ваш логин: ' + newData.email + '\nВаш новый пароль: ' + pass + '\n\nВойти в панель можно здесь http://chaochai.ru/page/partners\n\nВаша партнёрская ссылка находится внутри панели.'
      };
      transport.sendMail(message, function(error) {
        if(error){
          console.log(error.message);
          res.redirect('/regerror');
        } else {
          transport.close();
          saltAndHash(pass, function(hash) {
            o.pass       = hash;
            o.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
            console.log(o);
            o.save(function (err) {
              if (err) {
                res.send(e, 400);
              } else {
                res.redirect('/complete');
              }
            });
          });
        }
      });
    }
  });
}

var generateSalt = function() {
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
    var p = Math.floor(Math.random() * set.length);
    salt += set[p];
  }
  return salt;
}

var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

var saltAndHash = function(pass, callback) {
  var salt = generateSalt();
  callback(salt + md5(pass + salt));
}

var validatePassword = function(plainPass, hashedPass, callback) {
  var salt = hashedPass.substr(0, 10);
  var validHash = salt + md5(plainPass + salt);
  callback(null, hashedPass === validHash);
}

//mongodb

mongoose.connect('mongodb://mongodb.fr1.server.sovechkin.com/mkama');

var UsersSchema = new Schema();

UsersSchema.add({
  partnerid   : { type: Number, unique: true },
  email       : { type: String, lowercase: true, unique: true },
  pass        : String,
  admin       : Boolean,
  orders      : Number,
  unique      : Number,
  created_at  : Date,
  updated_at  : Date,
  enabled     : Boolean
});

var OrdersSchema = new Schema();

OrdersSchema.add({
  orderid     : { type: Number, unique: true },
  number      : { type: Number, index: true },
  partnerid   : { type: Number, index: true },
  sum         : Number,
  quantity    : Number,
  status      : String,
  comment     : String,
  items       : [ItemsSchema],
  created_at  : Date,
  updated_at  : Date,
  enabled     : Boolean
});

var ItemsSchema = new Schema();

ItemsSchema.add({
  itemid      : { type: Number, index: true },
  productid   : Number,
  name        : String,
  quantity    : Number,
  sum         : Number
});

var Users = mongoose.model('Users', UsersSchema);
var Orders = mongoose.model('Orders', OrdersSchema);
