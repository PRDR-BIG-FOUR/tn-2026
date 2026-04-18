from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/search",summary="Keyword Search",
             description="Used to search for a specific keyword related promises in the manifesto. The search is performed using a vector database, which allows for efficient retrieval of relevant information based on semantic similarity.")
async def sematic_search(input_keyword: str, request: Request):
    try:
        print("Received search request with keyword:", input_keyword)
        #TODO: Add actual function call for semantic search here
    except Exception as e:
        return HTTPException(status_code=500, detail=str(e))