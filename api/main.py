from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from io import BytesIO
import shutil

app = FastAPI()

# CORS settings for allowing frontend to access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process_image/")
async def process_image(file: UploadFile = File(...), points: str = Form(...)):

    print(points)
    # Read the image file and store it in a buffer
    buffer = BytesIO(file.file.read())
    
    # Convert the buffer contents to a numpy array and read it into an OpenCV image
    nparr = np.frombuffer(buffer.getvalue(), np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Perform simple logic: converting to grayscale
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Encode the processed image to send as a response
    is_success, buffer = cv2.imencode(".jpg", gray_image)
    if not is_success:
        raise Exception("Could not encode image!")
    
    # Convert to bytes
    image_stream = BytesIO(buffer.tobytes())

    return StreamingResponse(image_stream, media_type="image/jpeg")
