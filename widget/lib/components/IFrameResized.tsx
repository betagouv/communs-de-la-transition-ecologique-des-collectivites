import IframeResizer from "@iframe-resizer/react";
import { useRef } from "react";

interface IFrameResizedProps {
  src: string;
}

const IFrameResized = ({ src }: IFrameResizedProps) => {
  const iframeRef = useRef(null);
  // const [ready, setReady] = useState(false);
  return (
    <>
      <IframeResizer
        license="GPLv3"
        src={src}
        forwardRef={iframeRef}
        style={{ width: "100%", height: "100vh" }}
      />
    </>
  );
};

export default IFrameResized;
