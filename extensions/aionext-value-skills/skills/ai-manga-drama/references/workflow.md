# AI Manga Drama Workflow

## Episode Files

Use one episode folder per finished short:

```text
episode-01/
  storyboard.csv
  siliconflow-video-jobs.json
  subtitles.srt
  assets/panels/
  assets/clips/
  assets/audio/
  output/
```

## Shot Planning

Keep every shot between 3 and 6 seconds unless the user asks otherwise. Make one job per camera beat:

- close-up reaction
- hand reaches for object
- door opens
- reveal shot
- reverse angle
- transition shot

## Clip Naming

Use stable IDs:

- `S001`
- `S002`
- `S003`

Downloaded clips should be saved as:

```text
assets/clips/S001.mp4
assets/clips/S002.mp4
```

## Prompt Pattern

For each job, write:

```text
<character identity and outfit>, <single action>, <background>, <camera movement>, <lighting>, vertical anime cinematic style, clean composition
```

For I2V, focus on motion:

```text
The character blinks once, hair and coat move in the rain, neon reflections ripple, slow push-in camera, no change to character identity.
```
