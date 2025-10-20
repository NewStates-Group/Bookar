"use client";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="logo">B</div>
      <ul>
        <li>
          <div className="icon"><i className="fa-solid fa-house"></i></div>
          <span>Geral</span>
        </li>
        <li>
          <div className="icon"><i className="fa-solid fa-book-open"></i></div>
          <span>Cursos</span>
        </li>
        <li>
          <div className="icon"><i className="fa-solid fa-chalkboard-user"></i></div>
          <span>Explicador</span>
        </li>
        <li>
          <div className="icon"><i className="fa-solid fa-user-graduate"></i></div>
          <span>Tutor</span>
        </li>
      </ul>
    </div>
  );
}
