// Netlify Function: validate-word
// Valida se uma palavra existe em português usando a API do Dicionário Aberto
// Endpoint: /.netlify/functions/validate-word?word=LINDA

const https = require('https');

// Cache em memória (dura enquanto a função estiver "quente")
const cache = new Map();

// Palavras do jogo — sempre válidas
const GAME_WORDS = new Set([
  'LINDA','FOFA','INCRIVEL','PERFEITA','CARINHOSA','ENGRACADA',
  'CHEIROSA','MARAVILHOSA','ESPECIAL','UNICA','GOSTOSA','ENCANTADORA'
]);

function normalizeWord(w) {
  return w.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z]/g, '');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const raw = event.queryStringParameters?.word || '';
  const word = normalizeWord(raw);

  if (!word || word.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ valid: false, reason: 'empty' }) };
  }

  // Palavra do jogo → sempre válida
  if (GAME_WORDS.has(word)) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: true, source: 'game' }) };
  }

  // Cache hit
  if (cache.has(word)) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: cache.get(word), source: 'cache' }) };
  }

  // Tenta API do Free Dictionary (suporta pt)
  try {
    const wordLower = word.toLowerCase();
    const res = await fetchUrl(`https://api.dictionaryapi.dev/api/v2/entries/pt/${wordLower}`);
    const valid = res.status === 200;
    cache.set(word, valid);
    return { statusCode: 200, headers, body: JSON.stringify({ valid, source: 'dictionary' }) };
  } catch (err) {
    // Se a API falhar, aceita a palavra (não penaliza o jogador)
    return { statusCode: 200, headers, body: JSON.stringify({ valid: true, source: 'fallback' }) };
  }
};
