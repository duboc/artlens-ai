import React, { useEffect, useState } from 'react';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  frozenImage?: string | null;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ videoRef, frozenImage }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: 'environment', // Prefer back camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicitly play for mobile browsers
          videoRef.current.play().catch(e => console.log("Play failed, waiting for user interaction or metadata", e));
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setHasPermission(false);
      }
    };

    if (!frozenImage) {
        startCamera();
    }

    return () => {
      // Cleanup stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef, frozenImage]);

  const handleCanPlay = () => {
      if (videoRef.current) {
          videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
      }
  };

  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-900 text-white p-4 text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
          <p>Please allow camera access to use the AR identification features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      {/* Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleCanPlay}
        className={`absolute top-0 left-0 w-full h-full object-cover ${frozenImage ? 'hidden' : 'block'}`}
      />
      
      {/* Frozen Image Overlay */}
      {frozenImage && (
        <img 
            src={frozenImage} 
            alt="Frozen Frame" 
            className="absolute top-0 left-0 w-full h-full object-cover"
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
    </div>
  );
};