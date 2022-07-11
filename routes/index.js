const express = require("express");
const fs = require("fs");
const { S3 } = require("aws-sdk");
const { exec } = require("child_process")

const router = express.Router();

const s3 = new S3({
  apiVersion: "2006-03-01",
});

router.get("/hook/:id", async (req, res) => {
  const header = req.headers.authorization;

  if (!header) {
    res.status(401).json({
      message: "유효하지 않은 인증정보입니다."
    })

    return
  }

  const accessToken = header.replace("Bearer ", "")

  if (accessToken !== process.env.ADMIN_TOKEN) {
    res.status(401).json({
      message: "유효하지 않은 인증정보입니다."
    })

    return
  }

  const id = req.params.id;

  let readableStream;

  const key = `${id}/build.zip`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  }

  try {
    await s3.headObject(params).promise()
  } catch {
    res.status(404).json({
      message: "오브젝트가 존재하지 않습니다.",
    });

    return;
  }

  const dirname = process.env.DIST_DIRECTORY

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname)
  }

  const filename = `${process.env.DIST_DIRECTORY}/build.zip`

  if (fs.existsSync(filename)) {
    fs.rmSync(filename, { force: true })
  }

  readableStream = s3
    .getObject(params)
    .createReadStream();

  const file = fs.createWriteStream(filename);

  await new Promise((resolve, reject) => readableStream.on("close", resolve).on("error", reject).pipe(file))

  const shellname = `${process.env.DIST_DIRECTORY}/deploy.sh`

  if (!fs.existsSync(shellname)) {
    res.status(404).json({
      message: "실행할 배포 스크립트가 존재하지 않습니다."
    })

    return
  }

  const { PATH, HOME } = process.env

  exec(`sh deploy.sh ${id}`, {
    cwd: process.env.DIST_DIRECTORY,
    env: {
      PATH,
      HOME,
    }
  }, (err, stdout, stderr) => {
    console.log(stdout)
    console.log(stderr)
  })

  res.status(200).json({
    message: "객체가 성공적으로 배포되었습니다."
  })
});

module.exports = router;
