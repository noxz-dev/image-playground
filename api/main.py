from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from io import BytesIO
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator, SamPredictor
import imutils
import os

app = FastAPI()

# check if the model weights exists in the models folder

sam_checkpoint = "./models/sam_vit_h_4b8939.pth"

if os.path.exists(sam_checkpoint):
    device = "cuda"
    model_type = "default"
    print("started to load sam model")
    sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
    sam.to(device=device)
    print("finished loading sam model")

    sam_params = {
        "points_per_side": 32,
        "pred_iou_thresh": 0.88,
        "stability_score_thresh": 0.95,
        "stability_score_offset": 1.0,
        "box_nms_thresh":0.7,
        "crop_n_layers": 0,
        "crop_nms_thresh": 0.7,
        "crop_overlap_ratio": 512 / 1500,
        "crop_n_points_downscale_factor": 1,
        "min_mask_region_area": 0,
    }


# CORS settings for allowing frontend to access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process_image/")
async def process_image(file: UploadFile = File(...), points: str = Form(...), dimensions: str = Form(...)):

    print(points)
    print(dimensions)
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

# only add the sam endpoint if the model weights exists
if os.path.exists(sam_checkpoint):
    @app.post("/sam")
    async def segment_anything(file: UploadFile = File(...)):
        mask_generator = SamAutomaticMaskGenerator(sam, **sam_params)

        buffer = BytesIO(file.file.read())
        
        resize_width = 1024

        nparr = np.frombuffer(buffer.getvalue(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        image = imutils.resize(image, width=resize_width)

        masks = mask_generator.generate(image)
        annotations = show_anns(masks)

        is_success, buffer = cv2.imencode(".jpg", annotations)
        if not is_success:
            raise Exception("Could not encode image!")

        image_stream = BytesIO(buffer.tobytes())

        return StreamingResponse(image_stream, media_type="image/jpeg")


def show_anns(anns):
    if len(anns) == 0:
        return
    sorted_anns = sorted(anns, key=(lambda x: x['area']), reverse=True)
    
    ref = anns[0]['segmentation']

    canvas = np.zeros((ref.shape[0], ref.shape[1], 3))

    for ann in sorted_anns:
        m = ann['segmentation']
        color_mask = np.random.random((1, 3))
        canvas[m] = np.uint8(color_mask*255)
    return canvas
