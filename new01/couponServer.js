// couponServer.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;

const app = express();
app.use(bodyParser.json());

// Funções para manipulação de cupons
const loadCoupons = async () => {
    try {
        const data = await fs.readFile('coupons.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        throw err;
    }
};

const saveCoupons = async (coupons) => {
    try {
        await fs.writeFile('coupons.json', JSON.stringify(coupons, null, 2), 'utf8');
    } catch (err) {
        throw err;
    }
};

const loadExpiredCoupons = async () => {
    try {
        const data = await fs.readFile('expiredCoupons.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
};

const saveExpiredCoupons = async (expiredCoupons) => {
    try {
        await fs.writeFile('expiredCoupons.json', JSON.stringify(expiredCoupons, null, 2), 'utf8');
    } catch (err) {
        throw err;
    }
};

// Endpoint para criar cupom
app.post('/createcoupon', async (req, res) => {
    const coupon = req.body;

    if (!coupon.code || coupon.valid === undefined || coupon.discount === undefined || coupon.uniqueUse === undefined || !coupon.expirationDate) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes no payload do cupom.' });
    }

    try {
        const data = await fs.readFile('coupons.json', 'utf8');
        let coupons = JSON.parse(data);

        const existingCoupon = coupons.find(existing => existing.code === coupon.code);
        if (existingCoupon) {
            return res.status(400).json({ error: `Cupom com o código ${coupon.code} já existe.` });
        }

        coupon.createdAt = new Date().toISOString();
        coupons.push(coupon);
        await saveCoupons(coupons);

        res.json({ message: `Cupom ${coupon.code} criado com sucesso.` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar o cupom.' });
    }
});

// Endpoint para expirar cupom
app.post('/cupons/:code/expire', async (req, res) => {
    const { code } = req.params;
    const { expired, userId } = req.body;

    if (!expired || !userId) {
        return res.status(400).json({ error: 'Os campos "expired" e "userId" são obrigatórios no corpo da requisição.' });
    }

    try {
        const coupons = await loadCoupons();
        const coupon = coupons.find(c => c.code === code);

        if (!coupon) {
            return res.status(404).json({ error: `Cupom ${code} não encontrado.` });
        }

        coupon.valid = false;
        coupon.expirationDate = new Date().toISOString();
        await saveCoupons(coupons);

        const expiredCoupon = { ...coupon, expired, userId };
        const expiredCoupons = await loadExpiredCoupons();
        expiredCoupons.push(expiredCoupon);
        await saveExpiredCoupons(expiredCoupons);

        res.json({ message: `Cupom ${code} expirado com sucesso.`, updatedCoupon: expiredCoupon });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao expirar o cupom.', details: err.message });
    }
});

app.listen(3000, () => {
    console.log('couponServer rodando na porta 3000');
});
