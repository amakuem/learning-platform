import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/home";
import Course from "../pages/Course";
import Login from "../pages/login";
import Register from "../pages/register";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses/:courseId" element={<Course />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
