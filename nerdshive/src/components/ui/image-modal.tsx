import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { storageService } from '@/services/storageService';


interface ImageModalProps {
  imageUrl: string;
  title: string;
  triggerText?: string;
  triggerVariant?: "default" | "ghost" | "outline" | "secondary" | "destructive" | "link";
  bucket?: string;
  isStoragePath?: boolean;
}

export function ImageModal({ imageUrl, title, triggerText = "View", triggerVariant = "outline", bucket, isStoragePath }: ImageModalProps) {
  const [open, setOpen] = React.useState(false);
  const [resolvedUrl, setResolvedUrl] = React.useState<string>(imageUrl);

  React.useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    const resolveUrl = async () => {
      try {
        const isHttp = /^https?:\/\//i.test(imageUrl);
        if (isStoragePath && bucket && !isHttp) {
          let path = imageUrl;
          const publicMarker = "/storage/v1/object/public/";
          if (path.includes(publicMarker)) {
            const parts = path.split(publicMarker)[1]?.split("/") || [];
            parts.shift();
            path = parts.join("/");
          }
          const { data } = await apiClient.get(`/storage/${bucket}/${path}`);
          if (data?.signedUrl) {
            const response = await apiClient.get(data.signedUrl, { responseType: 'blob' });
            objectUrl = URL.createObjectURL(response.data);
            setResolvedUrl(objectUrl);
            return;
          }
        }
        setResolvedUrl(imageUrl);
      } catch (err) {
        console.error("Failed to resolve image URL", err);
        setResolvedUrl("/placeholder.svg");
      }
    };
    resolveUrl();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, imageUrl, bucket, isStoragePath]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Eye className="w-4 h-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center p-4">
          <img
            src={resolvedUrl}
            alt={title}
            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder.svg";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}