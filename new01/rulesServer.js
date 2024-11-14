// rulesServer.js
const express = require('express');
const { Engine } = require('json-rules-engine');
const bodyParser = require('body-parser');
const fs = require('fs').promises;

const app = express();
app.use(bodyParser.json());

const engine = new Engine();

// Função para carregar regras a partir de rules.json
const loadRules = async () => {
    try {
        const rulesData = await fs.readFile('rules.json', 'utf8');
        const rules = JSON.parse(rulesData);
        if (Array.isArray(rules)) {
            rules.forEach(rule => engine.addRule(rule));
        }
    } catch (err) {
        console.error('Erro ao carregar o arquivo rules.json:', err);
    }
};

loadRules();

// Endpoint de validação de cupons
app.post('/validate', async (req, res) => {
    const couponRequest = req.body;

    try {
        const data = await fs.readFile('coupons.json', 'utf8');
        let coupons = JSON.parse(data);
        
        const couponData = coupons.find(coupon => coupon.code === couponRequest.code);
        if (!couponData) {
            return res.status(400).json({ valid: false, message: 'Cupom não encontrado.' });
        }

        const isMetadataValid = (requestMetadata, couponMetadata) =>
            Object.keys(requestMetadata).every(key => requestMetadata[key] === couponMetadata[key]);

        if (!isMetadataValid(couponRequest.metadata, couponData.metadata)) {
            return res.json({ valid: false, message: 'Os valores do metadata não correspondem.' });
        }

        const facts = { "coupon-info": couponData };
        const results = await engine.run(facts);
        
        if (results.events.length > 0) {
            const event = results.events[0];
            const message = event.params.message.replace("{{discount}}", couponData.discount);
            res.json({ valid: true, message });
        } else {
            res.json({ valid: false, message: 'O cupom não é válido.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao validar o cupom.', details: err.message });
    }
});

app.listen(3001, () => {
    console.log('rulesServer rodando na porta 3001');
});
