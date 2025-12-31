# server/rag_service/academic_search.py
import asyncio
import aiohttp
import xml.etree.ElementTree as ET
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

async def search_arxiv(session: aiohttp.ClientSession, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Asynchronously searches the ArXiv API for papers."""
    base_url = 'http://export.arxiv.org/api/query?'
    search_query = f'search_query=all:{query}&start=0&max_results={max_results}&sortBy=relevance'
    
    logger.info(f"Querying ArXiv with: {query}")
    async with session.get(base_url + search_query) as response:
        response.raise_for_status()
        content = await response.text()
        
        root = ET.fromstring(content)
        papers = []
        for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
            paper = {
                'source': 'ArXiv',
                'title': entry.find('{http://www.w3.org/2005/Atom}title').text.strip(),
                'url': entry.find('{http://www.w3.org/2005/Atom}id').text.strip(),
                'summary': entry.find('{http://www.w3.org/2005/Atom}summary').text.strip(),
                'authors': [author.find('{http://www.w3.org/2005/Atom}name').text for author in entry.findall('{http://www.w3.org/2005/Atom}author')]
            }
            papers.append(paper)
        return papers

async def search_semantic_scholar(session: aiohttp.ClientSession, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Asynchronously searches the Semantic Scholar API."""
    base_url = 'https://api.semanticscholar.org/graph/v1/paper/search'
    params = {'query': query, 'limit': max_results, 'fields': 'title,url,abstract,authors'}
    
    logger.info(f"Querying Semantic Scholar with: {query}")
    async with session.get(base_url, params=params) as response:
        response.raise_for_status()
        
        data = await response.json()
        papers = []
        if 'data' in data:
            for item in data['data']:
                paper = {
                    'source': 'Semantic Scholar',
                    'title': item.get('title'),
                    'url': item.get('url'),
                    'summary': item.get('abstract'),
                    'authors': [author['name'] for author in item.get('authors', []) if 'name' in author]
                }
                papers.append(paper)
        return papers

async def search_all_apis(query: str, max_results_per_api: int = 3) -> List[Dict[str, Any]]:
    """Asynchronously searches all configured academic APIs and aggregates results."""
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
        tasks = [
            search_arxiv(session, query, max_results=max_results_per_api),
            search_semantic_scholar(session, query, max_results=max_results_per_api)
        ]
        
        results_from_tasks = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_results = []
        api_names = ['ArXiv', 'Semantic Scholar']
        for i, result in enumerate(results_from_tasks):
            if isinstance(result, Exception):
                logger.warning(f"Could not retrieve results from {api_names[i]}: {result}")
            else:
                all_results.extend(result)
                logger.info(f"Found {len(result)} results from {api_names[i]}.")

    # Simple de-duplication based on title
    unique_results = {paper['title'].lower(): paper for paper in all_results if paper.get('title')}.values()
    
    return list(unique_results)