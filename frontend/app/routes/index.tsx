import { Button } from "@/components/ui/button"; // Added Button import
import { Card } from "@/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import mongodb from "/mongodb.svg";
import mysql from "/mysql.svg";
import postgres from "/postgresql.svg";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="h-full w-full flex justify-center items-center gap-8">
      <Card className="w-72 h-72 relative group hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative h-full flex flex-col justify-center items-center gap-4">
          <img src={postgres} alt="" />
          <h2 className="text-2xl font-semibold text-zinc-100">PostgreSQL</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "postgresql" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="w-72 h-72 relative group hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative h-full flex flex-col justify-center items-center gap-4">
          <img src={mysql} alt="" />
          <h2 className="text-2xl font-semibold text-zinc-100">MySQL</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "mysql" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="w-72 h-72 relative group hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative h-full flex flex-col justify-center items-center gap-4">
          <img src={mongodb} alt="" />
          <h2 className="text-2xl font-semibold text-zinc-100">MongoDB</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "mongodb" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
