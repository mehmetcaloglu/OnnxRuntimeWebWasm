"use client";
import React, { useState, useEffect, useRef } from "react";
import { InferenceSession, Tensor } from "onnxruntime-web";
import { runModelUtils } from "../../utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import styles from "./Web.module.css";
import { Button } from "../ui/button";
import { CircleLoader, ClipLoader } from "react-spinners";
// import { Button } from '@shadcn/ui';

function WebcamModelUI({
  modelFilepath,
  warmupModel,
  preprocess,
  postprocess,
  stopComponent,
}) {
  const [sessionBackend, setSessionBackend] = useState("wasm");
  const [modelFile, setModelFile] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelInitializing, setModelInitializing] = useState(true);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamInitialized, setWebcamInitialized] = useState(false);

  const webcamElement = useRef(null);
  const webcamContainer = useRef(null);
  const [videoOrigWidth, setVideoOrigWidth] = useState(0);
  const [videoOrigHeight, setVideoOrigHeight] = useState(0);
  const [session, setSession] = useState(null);
  const [cpuSession, setCpuSession] = useState(null);
  const [inferenceTime, setInferenceTime] = useState(0);
  const [stopClicked, setStopClicked] = useState(true);

  useEffect(() => {
    debugger;
    webcamController();

    clearRects();
    clearCanvas();

    if (modelFilepath) {
      async function fetchModelFile() {
        const response = await fetch(modelFilepath);
        const arrayBuffer = await response.arrayBuffer();
        setModelFile(arrayBuffer);
      }

      fetchModelFile();
    }
  }, [sessionBackend, stopClicked]);

  useEffect(() => {
    if (modelFile) {
      try {
        initSession();
      } catch (e) {
        setModelLoadingError(true);
      }
    }
  }, [modelFile, modelFilepath]);

  useEffect(() => {
    if (!modelLoading) {
      webcamController();
    }
  }, [webcamInitialized, webcamEnabled]);

  useEffect(() => {
    if (webcamElement.current) {
      webcamElement.current.addEventListener("loadedmetadata", () => {
        setVideoOrigWidth(webcamElement?.current.videoWidth);
        setVideoOrigHeight(webcamElement.current.videoHeight);
        adjustVideoSize(
          webcamElement.current.videoWidth,
          webcamElement.current.videoHeight
        );
      });
    }
  }, []);

  const initSession = async () => {
    setSessionRunning(false);
    setModelLoadingError(false);
    let myCpuSession = null;
    try {
      setModelLoading(true);
      setModelInitializing(true);
      const cpuSess = await runModelUtils.createModelCpu(modelFile);
      setCpuSession(cpuSess);
      setSession(cpuSess);
      myCpuSession = cpuSess;
    } catch (e) {
      setModelLoading(false);
      setModelInitializing(false);

      setCpuSession(null);

      throw new Error("Error: Backend not supported.");
    }
    setModelLoading(false);

    await warmupModel(myCpuSession);

    setModelInitializing(false);
  };

  const webcamController = () => {
    debugger;
    if (!stopClicked) {
      debugger;
      clearRects();
      runLiveVideo();
    }
  };

  const setup = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      webcamElement.current.srcObject = stream;
      return new Promise((resolve) => {
        webcamElement.current.onloadedmetadata = () => {
          setVideoOrigWidth(webcamElement.current.videoWidth);
          setVideoOrigHeight(webcamElement.current.videoHeight);
          adjustVideoSize(
            webcamElement.current.videoWidth,
            webcamElement.current.videoHeight
          );
          resolve();
        };
      });
    } else {
      throw new Error("No webcam found!");
    }
  };

  const startCamera = async () => {
    if (!webcamInitialized) {
      setSessionRunning(true);
      try {
        await setup();
      } catch (e) {
        setSessionRunning(false);
        setWebcamEnabled(false);
        alert("No webcam found");
        return;
      }

      webcamElement.current.play();
      setWebcamInitialized(true);
      setSessionRunning(false);
    } else {
      await webcamElement.current.play();
    }

    setWebcamEnabled(true);
  };

  const runLiveVideo = async () => {
    console.log("runLiveVideo");
    console.log("webcamEnabled", webcamEnabled);
    debugger;
    if (!webcamEnabled) {
      debugger;
      await startCamera();
      return;
    }
    while (webcamEnabled) {
      console.log("webcamEnabled", webcamEnabled);
      debugger;
      const ctx = capture();

      await runModel(ctx);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  const runModel = async (ctx) => {
    setSessionRunning(true);
    const data = preprocess(ctx);
    let outputTensor;
    let myInferenceTime;
    [outputTensor, myInferenceTime] = await runModelUtils.runModel(
      session,
      data
    );

    clearRects();
    postprocess(outputTensor, myInferenceTime);
    setInferenceTime(myInferenceTime);
    setSessionRunning(false);
  };

  const clearCanvas = () => {
    setInferenceTime(0);
    const element = document.getElementById("input-canvas");
    if (element) {
      const ctx = element.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    }
  };

  const clearRects = () => {
    while (webcamContainer?.current?.childNodes?.length > 2) {
      webcamContainer.current.removeChild(
        webcamContainer.current.childNodes[1]
      );
    }
  };

  const capture = () => {
    const size = Math.min(videoOrigWidth, videoOrigHeight);
    const centerHeight = videoOrigHeight / 2;
    const beginHeight = centerHeight - size / 2;
    const centerWidth = videoOrigWidth / 2;
    const beginWidth = centerWidth - size / 2;

    const canvas = document.getElementById("screenshot");

    canvas.width = Math.min(
      webcamElement.current.width,
      webcamElement.current.height
    );
    canvas.height = Math.min(
      webcamElement.current.width,
      webcamElement.current.height
    );

    const context = canvas.getContext("2d");

    context.drawImage(
      webcamElement.current,
      beginWidth,
      beginHeight,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return context;
  };

  const adjustVideoSize = (width, height) => {
    const aspectRatio = width / height;
    if (width >= height) {
      webcamElement.current.width = aspectRatio * webcamElement.current.height;
    } else if (width < height) {
      webcamElement.current.height = webcamElement.current.width / aspectRatio;
    }
  };

  const handleChange = (event) => {
    setSessionBackend(event.target.value);
  };

  return (
    <Card>
      <CardHeader className="items-center">
        <div className="flex flex-1 self-center"></div>
      </CardHeader>
      {!modelLoading && !modelInitializing ? (
        <>
          <CardContent>
            <div
              className=" relative flex items-center justify-center w-full h-full bg-gray-100 rounded-lg shadow-md"
              style={{ width: "416px", height: "416px", aspectRatio: "auto" }}
            >
              <div
                className="webcam-container border rounded-md shadow-sm m-auto relative flex items-center justify-center"
                id="webcam-container"
                ref={webcamContainer}
                style={{ width: "416px", height: "416px" }}
              >
                <video
                  id="webcam"
                  autoPlay
                  playsInline
                  muted
                  ref={webcamElement}
                  width="416"
                  height="416"
                  style={{
                    width: "416px",
                    height: "416px",
                    objectFit: "cover",
                    display: webcamEnabled ? "block" : "none",
                  }}
                />
                {!webcamEnabled && (
                  <canvas id="input-canvas" width="416" height="416" />
                )}
              </div>
            </div>
            <div className="infer-time m-12 items-center text-center justify-center">
              {" "}
              <h1 className="text-center flex">
                Model Inference Time {inferenceTime} ms
              </h1>{" "}
            </div>
          </CardContent>
          <CardFooter className=" justify-center">
            <div className="self-center m-auto">
              {!modelLoading && !modelInitializing ? (
                <div className="m-12">
                  {stopClicked ? (
                    <Button
                      variant="primary"
                      className="m-4"
                      disabled={sessionRunning}
                      onClick={() => {
                        setStopClicked(false);
                        webcamController();
                      }}
                    >
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="m-4"
                      disabled={sessionRunning}
                      onClick={() => {
                        stopComponent();
                      }}
                    >
                      Stop Camera
                    </Button>
                  )}
                  {/* <Button
                    variant="destructive"
                    className="m-4"
                    disabled={sessionRunning}
                    onClick={webcamController}
                  >
                    {webcamEnabled ? "Stop Camera" : "Start Camera"}
                  </Button> */}
                </div>
              ) : (
                <div className="model-loading">Model Loading...</div>
              )}
              <canvas id="screenshot" style={{ display: "none" }} />
            </div>
          </CardFooter>
        </>
      ) : (
        // loading spinner and text
        <CardContent
          style={{
            height: "528px",
            width: "464px",
          }}
          // center everything in the
          className="flex items-center justify-center flex-col"
        >
          <div className="model-loading">Model Loading...</div>
          {/* spinner loading and text*/}
          <ClipLoader
            // give red color
            color={"#FF0000"}
            loading={true}
            size={150}
            aria-label="Loading Spinner"
            data-testid="loader"
          />
        </CardContent>
      )}
    </Card>
  );
}

export default WebcamModelUI;
