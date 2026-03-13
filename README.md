# AI-Powered Meeting & Sprint Manager

A premium, real-time platform for managing meetings, sprints, and team workloads with AI assistance. Built with **Next.js 15**, **InstantDB**, and **OpenAI**.

![Project Showcase](https://github.com/DINAKAR-S/Meetings-AI/blob/main/dashboard.png)

## 🚀 Key Features

- **AI Sprint Planning**: Automatically generate sprint plans and distribute tasks based on team capacity.
- **Real-time Collaboration**: Instant synchronization across all users using InstantDB's graph-based local-first architecture.
- **Intelligent Backlog**: Organize tasks with a powerful drag-and-drop interface and AI-driven prioritization.
- **Sprint Health Dashboard**: Visualize project progress, workload distribution, and team velocity at a glance.
- **Meeting Management**: Integrated tools for tracking meetings and action items.
- **Command Palette**: Quick navigation and action execution with `Ctrl+K`.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Database**: [InstantDB](https://instantdb.com/) (Graph-based, Real-time)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & Framer Motion
- **AI**: [OpenAI API](https://openai.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/)

## 🏁 Getting Started

### Prerequisites

- Node.js 20+
- An InstantDB App ID
- An OpenAI API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DINAKAR-S/Meetings-AI.git
   cd meetings
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_INSTANT_APP_ID=your_instant_app_id
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/app`: Next.js App Router pages and API routes.
- `src/components`: Reusable UI components (Sprint boards, AI widgets, Sidebars).
- `src/lib`: Utility functions and shared logic.
- `src/instant.schema.ts`: Database schema definitions for InstantDB.

## 📄 License

This project is private and intended for internal use.

---

Built with ❤️ by [Dinakar](https://github.com/DINAKAR-S)
