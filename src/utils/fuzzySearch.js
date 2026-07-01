const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
};

const calculateSimilarity = (str1, str2) => {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
};

const fuzzySearch = (query, products, options = {}) => {
  const {
    threshold = 0.6,
    maxResults = 20,
    searchFields = ['name', 'brand', 'description']
  } = options;

  const queryLower = query.toLowerCase().trim();
  
  // First try exact matches
  const exactMatches = products.filter(product => 
    searchFields.some(field => 
      product[field] && product[field].toLowerCase().includes(queryLower)
    )
  );

  if (exactMatches.length > 0) {
    return exactMatches.slice(0, maxResults);
  }

  // If no exact matches, try fuzzy matching
  const fuzzyMatches = products
    .map(product => {
      let bestScore = 0;
      
      searchFields.forEach(field => {
        if (product[field]) {
          const fieldText = product[field].toLowerCase();
          
          // Try matching against individual words
          const words = fieldText.split(/\s+/);
          words.forEach(word => {
            const score = calculateSimilarity(queryLower, word);
            bestScore = Math.max(bestScore, score);
          });
          
          // Also try matching against the full field text
          const fullScore = calculateSimilarity(queryLower, fieldText);
          bestScore = Math.max(bestScore, fullScore);
        }
      });

      return { product, score: bestScore };
    })
    .filter(match => match.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(match => match.product);

  return fuzzyMatches;
};

const getSearchSuggestions = (query, products, maxSuggestions = 5) => {
  const queryLower = query.toLowerCase().trim();
  const suggestions = new Set();
  
  products.forEach(product => {
    const nameWords = product.name.toLowerCase().split(/\s+/);
    const brandWords = product.brand ? product.brand.toLowerCase().split(/\s+/) : [];
    
    [...nameWords, ...brandWords].forEach(word => {
      if (word.length > 2 && word.startsWith(queryLower)) {
        suggestions.add(word);
      }
    });
  });

  return Array.from(suggestions).slice(0, maxSuggestions);
};

module.exports = {
  fuzzySearch,
  getSearchSuggestions,
  calculateSimilarity,
  levenshteinDistance
};
