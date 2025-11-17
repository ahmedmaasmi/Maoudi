import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchDoctorsTool,
  searchDoctors,
} from "./tools/searchDoctors.js";
import {
  checkAvailabilityTool,
  checkAvailability,
} from "./tools/checkAvailability.js";
import {
  bookAppointmentTool,
  bookAppointment,
} from "./tools/bookAppointment.js";
import {
  scheduleAppointmentTool,
  scheduleAppointment,
} from "./tools/scheduleAppointment.js";
import { geocodeTool, geocode } from "./tools/geocode.js";
import {
  parseMessageTool,
  parseMessage,
} from "./tools/parseMessage.js";
import {
  getDoctorScheduleTool,
  getDoctorSchedule,
} from "./tools/getDoctorSchedule.js";
import {
  getAppointmentStatsTool,
  getAppointmentStats,
} from "./tools/getAppointmentStats.js";
import {
  searchPatientsBySymptomTool,
  searchPatientsBySymptom,
} from "./tools/searchPatientsBySymptom.js";

const server = new Server(
  {
    name: "voice-appointment-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      searchDoctorsTool,
      checkAvailabilityTool,
      bookAppointmentTool,
      scheduleAppointmentTool,
      getDoctorScheduleTool,
      getAppointmentStatsTool,
      searchPatientsBySymptomTool,
      geocodeTool,
      parseMessageTool,
    ],
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "search_doctors":
        result = await searchDoctors(args as any);
        break;
      case "check_availability":
        result = await checkAvailability(args as any);
        break;
      case "book_appointment":
        result = await bookAppointment(args as any);
        break;
      case "schedule_appointment":
        result = await scheduleAppointment(args as any);
        break;
      case "get_doctor_schedule":
        result = await getDoctorSchedule(args as any);
        break;
      case "get_appointment_stats":
        result = await getAppointmentStats(args as any);
        break;
      case "search_patients_by_symptom":
        result = await searchPatientsBySymptom(args as any);
        break;
      case "geocode":
        result = await geocode(args as any);
        break;
      case "parse_message":
        result = await parseMessage(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

