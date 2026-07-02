import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, SwitchCamera, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  mode?: 'document' | 'selfie';
  title?: string;
  description?: string;
}

export function CameraModal({ 
  isOpen, 
  onClose, 
  onCapture, 
  mode = 'document',
  title,
  description 
}: CameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    mode === 'selfie' ? 'user' : 'environment'
  );
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Must await availability check before starting camera.
      // Running both concurrently causes checkCameraAvailability to stop
      // tracks that startCamera just acquired, resulting in a black preview.
      checkCameraAvailability().then(() => startCamera());
    } else {
      stopCamera();
    }

    // Cleanup function to ensure camera is stopped when component unmounts or modal closes
    return () => {
      console.log('Modal cleanup - stopping camera');
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    // Only restart camera on facingMode change when modal is already open
    // (not on initial open — that is handled by the isOpen effect above)
    if (isOpen && stream) {
      const timeoutId = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [facingMode]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      console.log('Component unmounting - final camera cleanup');
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log('Final cleanup - stopping track:', track.kind);
          track.stop();
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  // Bind stream to video element when stream or video element becomes available
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        console.log('Binding stream to video element via useEffect');
        video.srcObject = stream;
        video.play()
          .then(() => {
            console.log('Video playing via useEffect');
            setIsVideoReady(true);
          })
          .catch(err => {
            console.error('Error playing video in useEffect:', err);
          });
      }
    }
  }, [stream]);

  const checkCameraAvailability = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device or browser');
        return;
      }

      // Request permission first to get device labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop()); // Stop immediately
      } catch (permError) {
        console.warn('Permission request failed:', permError);
        setError('Camera permission denied. Please allow camera access and refresh the page.');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      setHasMultipleCameras(videoDevices.length > 1);
      
      console.log('Available cameras:', videoDevices);
      
      if (videoDevices.length === 0) {
        setError('No camera devices found on this device');
      }
    } catch (error) {
      console.error('Error checking camera availability:', error);
      setError('Unable to access camera devices');
    }
  };

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsVideoReady(false);
      
      // Stop existing stream before starting new one
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log('Stopping existing track:', track.kind);
          track.stop();
        });
        setStream(null);
      }

      // Clear video src before setting new stream
      if (videoRef.current) {
        // Clear previous stream without forcing a reload (prevents autoplay issues on iOS)
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }

      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920, min: 640 },
          height: { ideal: 720, max: 1080, min: 480 },
          frameRate: { ideal: 30, max: 60, min: 15 }
        },
        audio: false
      };

      let mediaStream: MediaStream;
      
      try {
        console.log('Requesting camera with constraints:', constraints);
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Camera stream obtained successfully');
      } catch (error) {
        console.warn('Error with specific constraints, trying fallback:', error);
        // Fallback: try without specific facing mode
        const fallbackConstraints: MediaStreamConstraints = {
          video: { 
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: false
        };
        try {
          console.log('Trying fallback constraints:', fallbackConstraints);
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          console.log('Fallback camera stream obtained successfully');
        } catch (fallbackError) {
          console.error('Both camera attempts failed:', fallbackError);
          throw fallbackError;
        }
      }

      // Verify we have a valid stream
      if (!mediaStream || mediaStream.getTracks().length === 0) {
        throw new Error('No video tracks available');
      }

      console.log('Setting stream and configuring video element');
      setStream(mediaStream);
      
      if (videoRef.current) {
        const video = videoRef.current;

        // Ensure autoplay on mobile browsers (especially iOS Safari)
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        
        // Attach stream
        video.srcObject = mediaStream; // Use mediaStream instead of state

        // Helper to start playback and mark readiness
        const playVideo = async () => {
          try {
            await video.play();
            console.log('Video playing successfully');
            setIsLoading(false);
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setIsVideoReady(true);
            }
          } catch (err) {
            console.error('Error playing video:', err);
            setError('Failed to start camera preview. Please try again.');
            setIsLoading(false);
          }
        };

        // Event listeners to detect readiness
        const handleLoadedMetadata = () => {
          console.log('Video metadata loaded');
          if (video.paused) {
            void playVideo();
          } else {
            setIsVideoReady(true);
          }
        };

        const handleCanPlay = () => {
          console.log('Video can play, starting playback');
          void playVideo();
        };

        const handleLoadedData = () => {
          console.log('Video data loaded');
          if (video.paused) {
            void playVideo();
          } else {
            setIsVideoReady(true);
          }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('loadeddata', handleLoadedData, { once: true });

        // Kick off immediately in case events don't fire promptly
        void playVideo();
      }
       
    } catch (error) {
      console.error('Error starting camera:', error);
      setError('Unable to access camera. Please ensure camera permissions are granted and try again.');
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    
    // Stop all stream tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label);
        track.stop();
      });
      setStream(null);
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
      videoRef.current.load(); // Reset video element
    }
    
      // Reset states
      setCapturedImage(null);
      setError(null);
      setIsVideoReady(false);
      
      console.log('Camera stopped successfully');
  };

  const switchCamera = () => {
    if (hasMultipleCameras) {
      setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready. Please try again.");
      return;
    }

    const video = videoRef.current;
    
    // Check if video is ready with proper dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      setError("Video not ready. Please wait for camera to load.");
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError("Canvas not supported");
      return;
    }

    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (mode === 'selfie') {
        // For selfie mode, flip the image horizontally
        context.save();
        context.scale(-1, 1);
        context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        context.restore();
      } else {
        // Draw the video frame to the canvas normally
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Convert canvas to data URL
      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataURL);
      setError(null);
    } catch (err) {
      console.error("Capture error:", err);
      setError("Failed to capture photo. Please try again.");
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const savePhoto = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `captured-image-${Date.now()}.jpg`, {
            type: 'image/jpeg'
          });
          
          console.log('Photo saved, stopping camera and closing modal...');
          
          // Stop camera first
          stopCamera();
          
          // Small delay to ensure camera is fully stopped before calling parent callbacks
          setTimeout(() => {
          onCapture(file);
          onClose();
          }, 100);
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const handleClose = () => {
    console.log('Handling modal close...');
    stopCamera();
    setCapturedImage(null);
    setError(null);
    onClose();
  };

  const defaultTitle = mode === 'selfie' ? 'Capture Your Photo' : 'Capture ID Document';
  const defaultDescription = mode === 'selfie' 
    ? 'Take a clear photo of yourself for identity verification'
    : 'Position your ID document within the frame and capture a clear photo';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                  <p className="text-sm text-muted-foreground">Starting camera...</p>
                  <p className="text-xs text-muted-foreground mt-1">Please allow camera access</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Camera Error</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={startCamera}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : capturedImage ? (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-cover rounded"
              />
            ) : stream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-full object-cover"
                  style={{ 
                    display: 'block',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                    minHeight: '300px',
                    backgroundColor: '#000',
                    borderRadius: '0.5rem'
                  }}
                  onLoadedData={(e) => {
                    const video = e.target as HTMLVideoElement;
                    console.log('Video data loaded:', video.videoWidth, 'x', video.videoHeight);
                  }}
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight, 'readyState:', video.readyState);
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setIsVideoReady(true);
                    }
                  }}
                  onCanPlay={(e) => {
                    const video = e.target as HTMLVideoElement;
                    console.log('Video can play:', video.videoWidth, 'x', video.videoHeight);
                    if (video.paused) {
                      video.play().catch(console.error);
                    }
                  }}
                  onPlay={() => {
                    console.log('Video started playing');
                  }}
                  onPause={() => {
                    console.log('Video paused');
                  }}
                  onError={(e) => {
                    console.error('Video element error:', e);
                    const video = e.target as HTMLVideoElement;
                    console.error('Video error details:', video.error);
                  }}
                  onStalled={() => {
                    console.warn('Video stalled');
                  }}
                  onWaiting={() => {
                    console.log('Video waiting for data');
                  }}
                />
                
                {/* Camera controls overlay */}
                {hasMultipleCameras && (
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={switchCamera}
                      className="bg-background/80 backdrop-blur-sm"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Camera overlay frame */}
                <div className="absolute inset-4 border-2 border-primary border-dashed rounded-lg pointer-events-none z-10">
                  <div className="absolute top-2 left-2 text-xs text-primary bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                    {mode === 'selfie' ? 'Position your face here' : 'Position ID here'}
                  </div>
                  {facingMode === 'user' && (
                    <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                      Front Camera
                    </div>
                  )}
                  {facingMode === 'environment' && (
                    <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                      Back Camera
                    </div>
                  )}
                </div>

                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && videoRef.current && (
                  <div className="absolute top-2 left-2 text-xs text-white bg-black/80 backdrop-blur-sm px-2 py-1 rounded z-20">
                    <div>Stream: {stream ? 'Active' : 'None'}</div>
                    <div>Video: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}</div>
                    <div>Ready: {videoRef.current.readyState}</div>
                    <div>Paused: {videoRef.current.paused ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No camera stream available</p>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={startCamera}
                    >
                      Start Camera
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={async () => {
                        await checkCameraAvailability();
                        await startCamera();
                      }}
                    >
                      Restart Camera
                    </Button>
                  </div>
                  </div>
                </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Camera controls */}
          <div className="flex gap-2">
            {capturedImage ? (
              <>
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={savePhoto}
                  className="flex-1 gradient-primary"
                >
                  Use Photo
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                {hasMultipleCameras && (
                  <Button
                    variant="secondary"
                    onClick={switchCamera}
                    disabled={isLoading || !!error}
                    className="px-3"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={startCamera}
                  disabled={isLoading}
                  className="px-3"
                  title="Restart Camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  onClick={capturePhoto}
                  disabled={!stream || isLoading || !!error || !isVideoReady}
                  className="flex-1 gradient-primary"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
              </>
            )}
          </div>
          
          {/* Help text */}
          {!capturedImage && !isLoading && !error && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {mode === 'selfie' 
                  ? 'Make sure your face is clearly visible and well-lit'
                  : 'Ensure the ID document is clearly readable and within the frame'
                }
              </p>
              {hasMultipleCameras && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tap the camera switch button to change between front and back camera
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}