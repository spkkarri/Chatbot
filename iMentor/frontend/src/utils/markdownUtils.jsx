// src/utils/markdownUtils.jsx
import katex from 'katex';
import DOMPurify from 'dompurify';

const decodeHtmlEntities = (encodedString) => {
  if (typeof encodedString !== 'string') return encodedString;

  const textarea = document.createElement('textarea');
  textarea.innerHTML = encodedString;
  return textarea.value;
};

export const renderMathInHtml = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') return htmlString;

  let processedString = htmlString;
  processedString = processedString.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (match, rawExpression) => {
    const expression = decodeHtmlEntities(rawExpression.trim());
    try {
      const rendered = katex.renderToString(expression, { 
        displayMode: true, 
        throwOnError: false,
        macros: {"\\RR": "\\mathbb{R}"} 
      });
      return DOMPurify.sanitize(rendered, { USE_PROFILES: { mathMl: true, svg: true, html: true } });
    } catch (e) { 
      console.warn(`KaTeX (display) error: ${e.message} for expression: ${expression}`); 
      return match; 
    }
  });

  processedString = processedString.replace(/(^|[^$\\])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$([^\$]|$)/g, (fullMatch, prefix, rawExpression, suffix) => {
    const expression = decodeHtmlEntities(rawExpression.trim());
    if (!expression) return fullMatch; 
    try {
      const rendered = katex.renderToString(expression, { 
        displayMode: false, 
        throwOnError: false,
        macros: {"\\RR": "\\mathbb{R}"}
      });
      return prefix + DOMPurify.sanitize(rendered, { USE_PROFILES: { mathMl: true, svg: true, html: true } }) + suffix;
    } catch (e) { 
      console.warn(`KaTeX (inline) error: ${e.message} for expression: ${expression}`);
      return fullMatch; 
    }
  });
  
  return processedString;
};