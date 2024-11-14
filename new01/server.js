const express = require('express');
const { Engine } = require('json-rules-engine');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // Using fs.promises assync operation
const path = require('path'); 
const fieldsPath = './fields.json';
const cron = require('node-cron');

let fieldsConfig;

const app = express();
app.use(bodyParser.json());

const engine = new Engine(); // Using Engine

//********* FUNCTION CRON TO CLEAN CUPONS AND RULES EXPIRATEDOR INVALIDS **************** */

// PATH OF FILES
const couponsPath = path.resolve(__dirname, 'coupons.json');
const expiredCouponsPath = path.resolve(__dirname, 'expiredCoupons.json');
const rulesPath = path.resolve(__dirname, 'rules.json');

// MAIN FUNCTION
async function processExpiredCoupons() {
  try {
    const currentDate = new Date();

    // LOADING COUPONS
    let coupons = JSON.parse(await fs.readFile(couponsPath, 'utf-8'));

    // FILTER EXPIRATION COUPONS AND INVALIDS (valid: false)
    const expiredCoupons = coupons.filter(coupon => 
      !coupon.valid || new Date(coupon.expirationDate) <= currentDate
    );

    // MODIFIED COUPONS EXPIRATED TO INCLUDED NEW FILEDS
    const expiredCouponsWithFields = expiredCoupons.map(coupon => ({
      ...coupon,
      expired: 'CRON',
      userId: 'Systems'
    }));

    // LOAD PREVIOUSLY SAVED EXPIRED COUPONS AND ADD THE NEW ONES
    const previousExpiredCoupons = JSON.parse(await fs.readFile(expiredCouponsPath, 'utf-8') || '[]');
    await fs.writeFile(expiredCouponsPath, JSON.stringify([...previousExpiredCoupons, ...expiredCouponsWithFields], null, 2));

    // UPDATE THE COUPON FILE BY REMOVING EXPIRED COUPONS
    coupons = coupons.filter(coupon => !expiredCoupons.includes(coupon));
    await fs.writeFile(couponsPath, JSON.stringify(coupons, null, 2));

   // LOAD THE RULES
    let rules = JSON.parse(await fs.readFile(rulesPath, 'utf-8'));

    // FILTER AND REMOVE RULES ASSOCIATED WITH EXPIRED COUPONS
    const updatedRules = rules.filter(rule => 
      !expiredCoupons.some(coupon => rule.conditions.all.some(cond => cond.value === coupon.code))
    );
    await fs.writeFile(rulesPath, JSON.stringify(updatedRules, null, 2));

    console.log(`${expiredCoupons.length} cupons expirados foram processados com sucesso.`);
  } catch (error) {
    console.error('Erro ao processar cupons expirados:', error);
  }
}

// EXECUTE THE FUNCTION IMMEDIATELY WHEN STARTING THE SERVER
processExpiredCoupons();

// SET UP THE CRON JOB TO RUN EVERY 5 MINUTES
cron.schedule('*/5 * * * *', processExpiredCoupons);

// SET UP THE CRON JOB TO RUN DAILY AT MIDNIGHT
//cron.schedule('0 0 * * *', processExpiredCoupons);


//***************************** END CRON FUNCTION ********************************



// FUNCTION TO LOAD COUPONS FROM FILE
async function loadCoupons() {
  const data = await fs.readFile('coupons.json', 'utf-8');
  return JSON.parse(data);
}

// FUNCTION TO SAVE COUPONS TO THE ORIGINAL FILE
async function saveCoupons(coupons) {
  await fs.writeFile('coupons.json', JSON.stringify(coupons, null, 2));
}

// FUNCTION TO SAVE THE USED COUPON TO THE 'USEDSCOUPONS.JSON' FILE
async function saveUsedCoupon(couponData) {
  const filePath = path.resolve(__dirname, 'usedCoupons.json'); // USING THE PATH MODULE WITHOUT CONFLICT
  let usedCoupons = [];

  try {
    const data = await fs.readFile(filePath, 'utf8');
    usedCoupons = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // IGNORE ERROR IF THE FILE DOES NOT EXIST
  }

  usedCoupons.push(couponData);
  await fs.writeFile(filePath, JSON.stringify(usedCoupons, null, 2));
}

// LOAD USED COUPONS FROM FILE
const loadUsedCoupons = async () => {
  try {
    const data = await fs.readFile('usedCoupons.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
};

// SAVE USED COUPONS TO THE FILE
const saveUsedCoupons = async (usedCoupons) => {
  try {
    await fs.writeFile('usedCoupons.json', JSON.stringify(usedCoupons, null, 2), 'utf8');
  } catch (err) {
    throw err;
  }
};

  // FUNCTION TO LOAD EXPIRED COUPONS FROM FILE
  const loadExpiredCoupons = async () => {
    try {
      const data = await fs.readFile('expiredCoupons.json', 'utf8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  };
  
 // FUNCTION TO SAVE EXPIRED COUPONS TO THE FILE
  const saveExpiredCoupons = async (expiredCoupons) => {
    try {
      await fs.writeFile('expiredCoupons.json', JSON.stringify(expiredCoupons, null, 2), 'utf8');
    } catch (err) {
      throw err;
    }
  };

// FUNCTION TO SAVE THE HISTORY OF USED COUPONS
async function saveUsedCoupon(couponData) {
  const filePath = path.resolve(__dirname, 'usedCoupons.json');
  let usedCoupons = [];

  try {
    const data = await fs.readFile(filePath, 'utf8');
    usedCoupons = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  usedCoupons.push(couponData);
  await fs.writeFile(filePath, JSON.stringify(usedCoupons, null, 2));
}

// FUNCTION TO LOAD RULES FROM RULES.JSON
const loadRules = async () => {
  try {
    const rulesData = await fs.readFile('rules.json', 'utf8');
    const rules = JSON.parse(rulesData);

    if (Array.isArray(rules)) {
      rules.forEach(rule => engine.addRule(rule)); // ADD EACH RULE TO THE ENGINE
    } else {
      console.error('Erro: rules.json não é um array de regras.');
    }
  } catch (err) {
    console.error('Erro ao carregar o arquivo rules.json:', err);
  }
};

loadRules();

// FUNCTION TO LOAD FIELDS FROM FIELDS.JSON
const loadFieldsConfig = async () => {
  try {
    const data = await fs.readFile(fieldsPath, 'utf8');
    fieldsConfig = JSON.parse(data);
  } catch (err) {
    console.error('Erro ao carregar fields.json:', err);
  }
};

loadFieldsConfig();

// FUNCTION TO ADD NEW FIELDS TO FIELDS.JSON AND UPDATE FIELDSCONFIG IN MEMORY *** SHOULD BE CACHE IN MEMORY
const addNewFieldsToJSON = async (newFields) => {
  try {
    const currentConfig = fieldsConfig || { fields: [] };

    newFields.forEach(field => {
      if (!currentConfig.fields.includes(field)) {
        currentConfig.fields.push(field);
      }
    });

    await fs.writeFile(fieldsPath, JSON.stringify(currentConfig, null, 2));
    fieldsConfig = currentConfig; // UPDATE FIELDSCONFIG IN MEMORY
  } catch (err) {
    console.error('Erro ao adicionar novos campos ao fields.json:', err);
  }
};

// DEFINE THE CREATECOUPONRULE FUNCTION TO CREATE A RULE BASED ON THE PROVIDED COUPON
function createCouponRule(coupon) {
  return {
    conditions: {
      all: [
        { fact: "coupon-info", operator: "equal", value: coupon.code, path: "$.code" },
        { fact: "coupon-info", operator: "equal", value: coupon.valid, path: "$.valid" },
        { fact: "coupon-info", operator: "greaterThan", value: 0, path: "$.discount" },
        { fact: "coupon-info", operator: "equal", value: coupon.uniqueUse, path: "$.uniqueUse" },
        { fact: "coupon-info", operator: "equal", value: coupon.metadata.isClub, path: "$.metadata.isClub" }
      ]
    },
    event: {
      type: "apply-discount",
      params: {
        message: `Cupom ${coupon.code} é válido! Desconto de {{discount}}%`,
        discount: {
          fact: "coupon-info",
          path: "$.discount"
        }
      }
    }
  };
}

//************  LIST COUPONS **************/

// ENDPOINT TO LIST ALL COUPONS
app.get('/listCoupons', async (req, res) => {
  try {
    const coupons = await loadCoupons();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar cupons.', error: error.message });
  }
});

//************  CREATE COUPON **************/

// ENDPOINT TO CREATE A COUPON
app.post('/createcoupon', async (req, res) => {
  const coupon = req.body;

 // VALIDATE MANDATORY FIELDS, INCLUDING EXPIRATIONDATE
  if (!coupon.code || coupon.valid === undefined || coupon.discount === undefined || coupon.uniqueUse === undefined || !coupon.expirationDate) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes no payload do cupom.' });
  }

  // PROCESS THE METADATA FIELDS
  const metadataFields = Object.keys(coupon.metadata || {});
  await addNewFieldsToJSON(metadataFields);

  try {
    const data = await fs.readFile('coupons.json', 'utf8');
    let coupons = [];

    try {
      coupons = JSON.parse(data);
    } catch (parseError) {
      return res.status(500).json({ error: 'Erro ao processar o arquivo coupons.json' });
    }

   // CHECK IF THE COUPON ALREADY EXISTS BY CODE
    const existingCoupon = coupons.find(existing => existing.code === coupon.code);
    if (existingCoupon) {
      return res.status(400).json({ error: `Cupom com o código ${coupon.code} já existe.` });
    }

    // ADD THE NEW COUPON TO THE LIST, WITH `CREATEDAT`
    coupon.createdAt = new Date().toISOString();
    coupons.push(coupon);
    await fs.writeFile('coupons.json', JSON.stringify(coupons, null, 2), 'utf8');

    // CREATE THE COUPON RULE, BUT WITHOUT THE `EXPIRATIONDATE` FIELD
    const { expirationDate, ...couponWithoutExpiration } = coupon;
    const newRule = createCouponRule(couponWithoutExpiration);

    const rulesData = await fs.readFile('rules.json', 'utf8');
    let rules = [];

    try {
      rules = JSON.parse(rulesData);
    } catch (parseError) {
      return res.status(500).json({ error: 'Erro ao processar o arquivo rules.json' });
    }

    rules.push(newRule);
    await fs.writeFile('rules.json', JSON.stringify(rules, null, 2), 'utf8');

    // ADD THE NEW RULE TO THE RULE ENGINE
    engine.addRule(newRule);
    res.json({ message: `Cupom ${coupon.code} criado com sucesso e regra correspondente adicionada.` });

  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar o cupom.' });
  }
});


//*************** VALIDATE COUPONS ***********************/

// ENDPOINT TO VALIDATE COUPONS
app.post('/validate', async (req, res) => {
  const { code, discount, uniqueUse, metadata, totalAmount } = req.body;

  try {
    const data = await fs.readFile('coupons.json', 'utf8');
    let coupons;

    try {
      coupons = JSON.parse(data);
    } catch (parseError) {
      return res.status(500).json({ error: 'Erro ao processar o arquivo coupons.json' });
    }

    // FIND THE COUPON BY CODE
    const couponData = coupons.find(coupon => coupon.code === code);

    // CHECK IF THE COUPON EXISTS
    if (!couponData) {
      return res.status(400).json({ valid: false, message: 'Cupom não encontrado.' });
    }

    // FUNCTION TO COMPARE THE PAYLOAD METADATA WITH THE ACTUAL COUPON METADATA
    function isMetadataValid(requestMetadata, couponMetadata) {
      return Object.keys(requestMetadata).every(key =>
        requestMetadata[key] === couponMetadata[key]
      );
    }

    // CHECK IF THE PAYLOAD METADATA MATCHES THE COUPON METADATA
    if (!isMetadataValid(metadata, couponData.metadata)) {
      return res.json({ valid: false, message: 'Os valores do metadata não correspondem.' });
    }

    // CALCULATE THE DISCOUNT AND FINAL AMOUNT IF THE TOTALAMOUNT IS PROVIDED
    let discountAmount = 0;
    let finalAmount = totalAmount;

    if (totalAmount && typeof totalAmount === 'number') {
      discountAmount = (discount / 100) * totalAmount;
      finalAmount = totalAmount - discountAmount;
    }

    // EXECUTE THE RULE ENGINE
    const results = await engine.run({ "coupon-info": couponData });
    if (results.events.length > 0) {
      const event = results.events[0];
      const message = event.params.message.replace("{{discount}}", couponData.discount);

      res.json({
        valid: true,
        message: message,
        discountApplied: discountAmount.toFixed(2),
        finalAmount: finalAmount.toFixed(2)
      });
    } else {
      res.json({ valid: false, message: 'O cupom não é válido.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao validar o cupom.', details: err.message });
  }
});


//*************** EXPIRE COUPONS ********************/

// ENDPOINT TO EXPIRE A COUPON
app.post('/cupons/:code/expire', async (req, res) => {
    const { code } = req.params;
    const { expired, userId } = req.body;
  
    // VALIDATE MANDATORY FIELDS
    if (!expired || !userId) {
      return res.status(400).json({ error: 'Os campos "expired" e "userId" são obrigatórios no corpo da requisição.' });
    }
  
    try {
      // LOAD COUPONS FROM FILE
      const coupons = await loadCoupons();
  
      // FIND THE COUPON BY CODE
      const coupon = coupons.find(c => c.code === code);
  
      if (!coupon) {
        return res.status(404).json({ error: `Cupom ${code} não encontrado.` });
      }
  
      // UPDATE COUPON FIELDS
      coupon.valid = false;
      coupon.expirationDate = new Date().toISOString();
  
      // SAVE CHANGES TO THE COUPONS FILE
      await saveCoupons(coupons);
  
      // PREPARE THE EXPIRED COUPON WITH ADDITIONAL FIELDS FROM THE BODY
      const expiredCoupon = {
        ...coupon,
        expired,
        userId
      };
  
      // LOAD EXPIRED COUPONS AND ADD THE NEW EXPIRED COUPON
      const expiredCoupons = await loadExpiredCoupons();
      expiredCoupons.push(expiredCoupon);
  
      // SAVE THE EXPIRED COUPON TO EXPIREDCoupons.JSON
      await saveExpiredCoupons(expiredCoupons);
  
      res.json({ message: `Cupom ${code} expirado com sucesso.`, updatedCoupon: expiredCoupon });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao expirar o cupom.', details: err.message });
    }
  });


//*************** WHEN PAYMENT IS CONFIRMED, EXPIRE OR ACCOUNT COUPONS ********************/

// POST ENDPOINT FOR PAYMENT CONFIRMATION AND COUPON HANDLING
app.post('/cupons/confirm-payment', async (req, res) => {
  const { couponCode, orderID, userID, transactionId, discountAmount } = req.body;

  try {
    const coupons = await loadCoupons();

    // FIND THE COUPON BY CODE
    const coupon = coupons.find(c => c.code === couponCode);

    // CHECK IF THE COUPON EXISTS AND IS VALID
    if (!coupon) {
      return res.status(400).json({ message: 'Cupom não encontrado.' });
    }

    if (!coupon.valid) {
      return res.status(400).json({ message: 'Cupom inválido.' });
    }

    // CHECK IF THE REQUESTED DISCOUNT MATCHES THE COUPON DISCOUNT
    if (discountAmount !== coupon.discount) {
      return res.status(400).json({ message: 'Valor de desconto incorreto.' });
    }

    // CHECK IF THE COUPON HAS EXPIRED
    const now = new Date();
    const expirationDate = new Date(coupon.expirationDate);
    if (now > expirationDate) {
      return res.status(400).json({ message: 'Cupom expirado.' });
    }

    // IF IT'S A SINGLE-USE COUPON, MARK IT AS INVALID AND UPDATE THE EXPIRATION DATE
    if (coupon.uniqueUse) {
      coupon.valid = false;
      await fs.writeFile('coupons.json', JSON.stringify(coupons, null, 2));
    } else {
      // IF IT'S NOT A SINGLE-USE COUPON, SAVE IT TO THE USED COUPONS FILE
      const usedCouponData = {
        code: coupon.code,
        orderID,
        userID,
        transactionId,
        discount: coupon.discount,
        metadata: coupon.metadata,
        usedAt: now.toISOString()
      };
      await saveUsedCoupon(usedCouponData);
    }

    res.json({
      message: `Pagamento confirmado para o pedido ${orderID} usando o cupom ${couponCode}.`,
      discountApplied: discountAmount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao processar o pagamento.', error: error.message });
  }
});
 

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
