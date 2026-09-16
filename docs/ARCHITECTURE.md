# Data model and request path

1. Browser POSTs multipart PDF/DOCX to `/api/documents/upload`.
2. Multer stores the blob under `uploads/`; a document row is created with
   `analysisStatus=processing`.
3. Background job extracts text, calls the model, writes analysis items and a
   summary row, then marks the document complete.
4. Client polls `/api/documents/:id` and renders extracted text plus findings.

Session cookies scope all reads and writes. No Replit OIDC path remains in this
tree.
