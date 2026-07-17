import type { ComponentType, SVGProps } from "react";

type VisualProps = SVGProps<SVGSVGElement>;
type VisualComponent = ComponentType<VisualProps>;

const baseProps = {
  viewBox: "0 0 120 90",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
} as const;

export const Bed: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path fill="#8B633D" d="M12 16h9v58h-9z"/><rect x="18" y="32" width="90" height="34" rx="6" fill="#DCC9AE"/><path fill="#B5654A" d="M55 48h53v18H55z"/><rect x="22" y="35" width="30" height="15" rx="6" fill="#FFF"/><path stroke="#6E4C30" strokeWidth="4" d="M18 68v8m88-8v8"/></svg>
);
export const SofaBed: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="10" y="37" width="100" height="31" rx="8" fill="#C7A98B"/><rect x="15" y="24" width="90" height="25" rx="9" fill="#E1D2BF"/><path stroke="#987657" strokeWidth="3" d="M60 26v40"/><path fill="#795739" d="M20 68h7v8h-7zm73 0h7v8h-7z"/><rect x="23" y="28" width="31" height="15" rx="5" fill="#F6F1EA"/></svg>
);
export const Sofa: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="13" y="37" width="94" height="32" rx="10" fill="#C78973"/><rect x="20" y="22" width="80" height="30" rx="11" fill="#D9AA98"/><path stroke="#B27761" strokeWidth="3" d="M60 25v40"/><circle cx="13" cy="50" r="10" fill="#B97862"/><circle cx="107" cy="50" r="10" fill="#B97862"/><path stroke="#694A36" strokeWidth="5" d="M27 68v8m66-8v8"/></svg>
);
export const Nightstand: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="29" y="20" width="62" height="58" rx="4" fill="#9A7048"/><path stroke="#604229" strokeWidth="3" d="M31 47h58"/><circle cx="60" cy="35" r="3" fill="#E7D4B7"/><circle cx="60" cy="62" r="3" fill="#E7D4B7"/><path stroke="#604229" strokeWidth="4" d="M36 77v6m48-6v6"/></svg>
);
export const SideTable: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><ellipse cx="60" cy="27" rx="34" ry="12" fill="#C39868"/><path stroke="#805A36" strokeWidth="6" d="M60 36v38"/><path stroke="#805A36" strokeWidth="5" strokeLinecap="round" d="m60 69-22 10m22-10 22 10"/><ellipse cx="60" cy="24" rx="26" ry="7" fill="#D8B78F"/></svg>
);
export const Table: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="10" y="25" width="100" height="15" rx="4" fill="#B98B57"/><path stroke="#795331" strokeWidth="6" d="M20 39v39m80-39v39"/><path stroke="#8C653F" strokeWidth="4" d="M24 51h72"/><circle cx="88" cy="19" r="6" fill="#6F8659"/></svg>
);
export const Desk: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path fill="#A97845" d="M8 24h104v13H8z"/><path stroke="#704A2B" strokeWidth="6" d="M18 37v42m84-42v42"/><rect x="18" y="39" width="34" height="25" rx="2" fill="#C69A68"/><path stroke="#805A36" strokeWidth="2" d="M20 51h30"/><circle cx="43" cy="45" r="2" fill="#5E4028"/><path stroke="#4A4B4A" strokeWidth="3" d="M70 23V12h25v11"/></svg>
);
export const Chair: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="33" y="10" width="54" height="39" rx="12" fill="#7E9270"/><rect x="29" y="43" width="62" height="20" rx="8" fill="#607853"/><path stroke="#4E493F" strokeWidth="5" d="M38 61 31 80m51-19 7 19M60 62v11m-16 8h32"/></svg>
);
export const Bookshelf: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="24" y="7" width="72" height="76" rx="3" fill="#B79A72"/><path stroke="#755538" strokeWidth="4" d="M29 28h62M29 53h62M29 77h62"/><path fill="#647A58" d="M33 12h8v14h-8z"/><path fill="#A55E50" d="M43 10h10v16H43z"/><path fill="#E0C184" d="M57 36h9v15h-9z"/><path fill="#596F84" d="M69 34h12v17H69z"/><path fill="#ECE1CC" d="M34 60h20v15H34z"/></svg>
);
export const Hanger: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path stroke="#594C3D" strokeWidth="5" strokeLinecap="round" d="M22 15h76M28 15v66m64-66v66M16 81h88"/><path stroke="#826A51" strokeWidth="3" d="M49 17v9L36 38h26L49 26m29-9v9L65 38h26L78 26"/><path fill="#B56D5D" d="M36 38h26v30H36z"/><path fill="#7A8B70" d="M65 38h26v38H65z"/></svg>
);
export const Partition: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path fill="#A98D69" d="M13 8h94v74H13z"/><path stroke="#F0E7DA" strokeWidth="5" d="M44 9v72m32-72v72M14 33h92M14 58h92"/><path fill="#728361" d="M20 16h17v10H20z"/><path fill="#D4B88D" d="M51 40h18v12H51z"/><path fill="#916450" d="M82 64h17v11H82z"/></svg>
);
export const Wardrobe: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="22" y="7" width="76" height="76" rx="4" fill="#AD8A64"/><path stroke="#76563A" strokeWidth="3" d="M60 9v72"/><circle cx="53" cy="45" r="3" fill="#E8D8BC"/><circle cx="67" cy="45" r="3" fill="#E8D8BC"/><path stroke="#76563A" strokeWidth="4" d="M28 82v5m64-5v5"/></svg>
);
export const Drawer: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="24" y="14" width="72" height="67" rx="4" fill="#C19B70"/><path stroke="#7C5938" strokeWidth="3" d="M26 35h68M26 57h68"/><path stroke="#715033" strokeWidth="4" strokeLinecap="round" d="M54 25h12M54 46h12M54 68h12"/><path stroke="#715033" strokeWidth="5" d="M32 80v6m56-6v6"/></svg>
);
export const TvStand: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="10" y="33" width="100" height="37" rx="4" fill="#8A6039"/><path stroke="#573B25" strokeWidth="3" d="M43 35v33m34-33v33"/><circle cx="35" cy="51" r="3" fill="#D9BE94"/><circle cx="69" cy="51" r="3" fill="#D9BE94"/><path stroke="#573B25" strokeWidth="5" d="M20 69v9m80-9v9"/><rect x="42" y="13" width="36" height="16" rx="2" fill="#393B3B"/></svg>
);
export const Monitor: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="16" y="10" width="88" height="53" rx="5" fill="#333A3E"/><rect x="21" y="15" width="78" height="43" rx="2" fill="#9DB5B7"/><path fill="#C9D8D6" d="m28 49 23-26 14 16 10-10 18 20z"/><path stroke="#4A4A46" strokeWidth="6" d="M60 63v13"/><path stroke="#4A4A46" strokeWidth="5" strokeLinecap="round" d="M43 79h34"/></svg>
);
export const Tv: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="9" y="10" width="102" height="61" rx="6" fill="#262A2D"/><rect x="15" y="16" width="90" height="49" rx="2" fill="#738D92"/><circle cx="60" cy="40" r="13" fill="#A7B9B7"/><path fill="#E5ECE8" d="m56 32 12 8-12 8z"/><path stroke="#3D3E3B" strokeWidth="5" d="m35 71-9 10m59-10 9 10"/></svg>
);
export const Lamp: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path stroke="#302C27" strokeWidth="6" d="M60 31v45"/><path fill="#E3C88D" d="M37 8h46l10 31H27z"/><ellipse cx="60" cy="39" rx="33" ry="7" fill="#CFAE6C"/><ellipse cx="60" cy="79" rx="25" ry="7" fill="#302C27"/><circle cx="60" cy="35" r="7" fill="#FFF0A8"/></svg>
);
export const Rug: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path fill="#C8A985" d="m14 25 83-8 10 52-84 8z"/><path stroke="#F0E1CA" strokeWidth="4" d="m24 33 64-6 8 34-65 6z"/><path stroke="#8C6C4F" strokeWidth="3" d="m40 31 8 33m18-36 8 33"/><path stroke="#8C6C4F" strokeWidth="2" d="m19 77-1 8m9-9-1 8m72-15 1 8m7-9 2 8"/></svg>
);
export const Plant: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path fill="#9A7048" d="M39 57h42l-6 27H45z"/><path stroke="#47623D" strokeWidth="4" d="M60 59V18M57 44 40 29m23 18 17-19"/><ellipse cx="37" cy="25" rx="16" ry="8" transform="rotate(35 37 25)" fill="#638055"/><ellipse cx="82" cy="24" rx="16" ry="8" transform="rotate(-40 82 24)" fill="#526F48"/><ellipse cx="59" cy="15" rx="9" ry="16" fill="#718E60"/></svg>
);
export const Mirror: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><rect x="34" y="4" width="52" height="75" rx="24" fill="#876746"/><rect x="40" y="10" width="40" height="63" rx="19" fill="#C5D3D1"/><path stroke="#EDF3F0" strokeWidth="4" strokeLinecap="round" d="m50 23 19-8M47 35l29-13"/><path stroke="#61482F" strokeWidth="5" d="M60 79v7m-18 0h36"/></svg>
);
export const Curtain: VisualComponent = (props) => (
  <svg {...baseProps} {...props}><path stroke="#5E5142" strokeWidth="5" strokeLinecap="round" d="M10 10h100"/><path fill="#C99D8F" d="M16 13h39v68H9l10-18-7-17 8-17z"/><path fill="#B98274" d="M104 13H65v68h46l-10-18 7-17-8-17z"/><path stroke="#E0BBAF" strokeWidth="3" d="M28 15v62m15-62v62m49-62v62m-15-62v62"/><rect x="55" y="13" width="10" height="65" fill="#DFE7E3"/></svg>
);
