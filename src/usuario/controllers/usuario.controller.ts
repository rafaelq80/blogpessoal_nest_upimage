import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { UsuarioService } from "../services/usuario.service";
import { Usuario } from "../entities/usuario.entity";
import { JwtAuthGuard } from "../../auth/guard/jwt-auth.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";


@Controller("/usuarios")
@ApiTags('Usuario')
@ApiBearerAuth()
export class UsuarioController{

    constructor(private readonly usuarioService: UsuarioService){ }

    @UseGuards(JwtAuthGuard)
    @Get('/all')
    @HttpCode(HttpStatus.OK)
    findAll(): Promise<Usuario[]>{
        return this.usuarioService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get('/:id')
    @HttpCode(HttpStatus.OK)
    findById(@Param('id', ParseIntPipe) id: number): Promise<Usuario>{
        return this.usuarioService.findById(id)
    }

    @Post('/cadastrar')
    @UseInterceptors(FileInterceptor('file'))
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() usuario: Usuario,
        @UploadedFile() file: Express.Multer.File
    ): Promise<Usuario>{
        return this.usuarioService.create(usuario, file)
    }

    @UseGuards(JwtAuthGuard)
    @Put('/atualizar')
    @UseInterceptors(FileInterceptor('file'))
    @HttpCode(HttpStatus.OK)
    async update(
        @Body() usuario: Usuario,
        @UploadedFile() file: Express.Multer.File
    ): Promise<Usuario>{
        return this.usuarioService.update(usuario, file)
    }

}