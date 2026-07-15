"use client";

import dynamic from "next/dynamic";

const GarageScene = dynamic(() => import("./GarageScene"), {
  ssr: false,
  loading: () => <div className="groom3d groom-loading">loading garage</div>,
});

export function GarageRoom() {
  return (
    <div className="groom-wrap">
      <GarageScene />
      <p className="groom-cap muted">your workshop . it grows on its own as you learn . scroll to zoom</p>
    </div>
  );
}
