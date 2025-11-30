const { 
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

// Load database (orders.json)
let orders = {};
if (fs.existsSync("./orders.json")) {
  orders = JSON.parse(fs.readFileSync("./orders.json"));
}

// Save function
function saveOrders() {
  fs.writeFileSync("./orders.json", JSON.stringify(orders, null, 2));
}

// Buat client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Message, Partials.Channel]
});

// Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("joki")
    .setDescription("Buat order joki baru")
    .addStringOption(o => o.setName("nama").setDescription("Nama pelanggan").setRequired(true))
    .addStringOption(o => o.setName("jenis").setDescription("Jenis joki").setRequired(true))
    .addIntegerOption(o => o.setName("hari").setDescription("Durasi joki (hari)").setRequired(true))
    .addStringOption(o => o.setName("harga").setDescription("Harga joki").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// Pasang slash command
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands terpasang!");
  } catch (err) {
    console.log(err);
  }
})();

// Ready Event
client.on("ready", () => {
  console.log(`Bot login sebagai ${client.user.tag}`);
});

// Format hari Indonesia
const hariIndo = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// /joki handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "joki") {
    const nama = interaction.options.getString("nama");
    const jenis = interaction.options.getString("jenis");
    const harga = interaction.options.getString("harga");
    const durasi = interaction.options.getInteger("hari");

    const id = Date.now().toString().slice(-6);

    // Hitung hari mulai & selesai
    const now = new Date();
    const hariMulai = hariIndo[now.getDay()];

    const selesai = new Date(now);
    selesai.setDate(selesai.getDate() + durasi);
    const hariSelesai = hariIndo[selesai.getDay()];

    // Buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`done_${id}`)
        .setLabel("Done")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`cancel_${id}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

    // Embed final (pakai icon)
    const embed = new EmbedBuilder()
      .setTitle(`📌 Detail Order #${id}`)
      .setColor("Yellow")
      .setDescription(
        `**👤 Nama:** ${nama}\n` +
        `**🎮 Joki:** ${jenis}\n` +
        `**💵 Harga:** ${harga}\n` +
        `**📋 Status:** Proses\n\n` +

        `**⏳ Durasi**\n` +
        `📅 **Mulai :** ${hariMulai}\n` +
        `🗓️ **Selesai :** ${hariSelesai}`
      )
      .setTimestamp();

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    // Simpan ke database
    orders[id] = {
      nama,
      jenis,
      harga,
      durasi,
      hariMulai,
      hariSelesai,
      messageId: msg.id,
      channelId: msg.channelId
    };
    saveOrders();
  }
});

// Handle Done / Cancel buttons
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const [aksi, id] = interaction.customId.split("_");

  if (!orders[id]) {
    return interaction.reply({
      content: "Order tidak ditemukan atau sudah dihapus.",
      ephemeral: true
    });
  }

  const data = orders[id];
  const channel = await client.channels.fetch(data.channelId);
  const msg = await channel.messages.fetch(data.messageId);

  await msg.delete().catch(() => {});

  delete orders[id];
  saveOrders();

  if (aksi === "done") {
    await interaction.reply({ content: `Order #${id} selesai ✔`, ephemeral: true });
  } else {
    await interaction.reply({ content: `Order #${id} dibatalkan ❌`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);