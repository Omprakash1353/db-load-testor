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
    <div className="flex justify-center items-center gap-8 w-full h-full">
      <Card className="group relative w-72 h-72 hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative flex flex-col justify-center items-center gap-4 h-full">
          <img src={postgres} alt="" />
          <h2 className="font-semibold text-zinc-100 text-2xl">PostgreSQL</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "postgresql" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="group relative w-72 h-72 hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative flex flex-col justify-center items-center gap-4 h-full">
          <img src={mysql} alt="" />
          <h2 className="font-semibold text-zinc-100 text-2xl">MySQL</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "mysql" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card>

      {/* <Card className="group relative w-72 h-72 hover:scale-105 transition-transform duration-200">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-lg" />
        <div className="relative flex flex-col justify-center items-center gap-4 h-full">
          <img src={mongodb} alt="" />
          <h2 className="font-semibold text-zinc-100 text-2xl">MongoDB</h2>
          <Link to={`/db/$dbName`} params={{ dbName: "mongodb" }}>
            <Button variant="outline" className="mt-4">
              Run Test
            </Button>
          </Link>
        </div>
      </Card> */}
    </div>
  );
}
