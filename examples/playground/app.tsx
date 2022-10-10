import React from "react";
import { Route, Routes } from "react-router-dom";

import Index from "./index.nota";

export let App = () => {
  return (
    <Routes>
      <Route path="." element={<Index />} />
    </Routes>
  );
};
