# Frontend (React + Vite)

Libraries: react-router-dom, framer-motion (animations), lucide-react (icons),
react-markdown (formatted answers), react-hot-toast (notifications), @fontsource/inter (font).

    npm install
    npm run dev        # http://localhost:5173

Default is DEMO MODE (VITE_USE_MOCK=true in .env): fake data, no backend needed.
Login: any email. An email containing "admin" gets the admin role.

## Switching to the real backend
Set in .env:  VITE_USE_MOCK=false   and   VITE_API_URL=http://localhost:5000

## API contract the Node.js backend must follow
POST   /api/auth/register   {name,email,password} -> {token, user:{id,name,email,role}}
POST   /api/auth/login      {email,password}      -> {token, user}
GET    /api/chats                                 -> [{id,title}]
POST   /api/chats           {title}               -> {id,title}
GET    /api/chats/:id                             -> [{role,content,sources}]
POST   /api/chats/:id/messages {question}         -> streaming (text/event-stream):
         data: {"type":"token","text":"Hello "}
         data: {"type":"sources","sources":[{"doc":"Return Policy.pdf","page":4}]}
         data: {"type":"done"}
GET    /api/documents                             -> [{id,name,version,status,created_at}]
POST   /api/documents       multipart "file"      -> document
DELETE /api/documents/:id                         -> 204
GET    /api/analytics                             -> {documents,questionsToday,tokensUsed,unanswered}
All routes except auth need header:  Authorization: Bearer <token>
